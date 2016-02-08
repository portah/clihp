#!/usr/bin/env node
/**
 * Created by porter on 11/12/15.
 */

/*Getting usage string*/
var r_usage = [/^\busage\b:?\s+/gi];

///*Catching a line with possible args*/
//var r_args = [
//    /[\t ]+((, *)*[\-]{1,2}[\w\-_]+)+([=\[\],;\(\)\^\$"']*)+\s+.*/gm
//];

/*Tear down the line with particular tool args*/
var r_arg = [
    /^(\s+)(\-\w+)[\s+\|](.*)\s*/gm, //bedtools
    /^(\s+|\S+: )(\-\w+),?\s+(.*)\s*/gm, //samtools
    /^(\s+|\S+: )(\-\w+\/\w+),?\s+(.*)\s*/gm, //bcftools
    /( )*^([\-]{2}\S+)\s+(.*)\s*/gm, //STAR
    /^(\s+)([\-]{1,2}[\w+\-\.]+)[\s+\/](.*)\s*/gm //bowtie
];

/*Tear down the tool's usage*/
var r_usage_arg = [
    /(\[[^\]]*\])+|(<\S+>)+|(-{1,2}\S+\s\S+)|([\S+])+/g
];
///(-\w+) (<.*?>)/g, //bedtools
//    /([\[].*?[\]]\s+)*<(.*?)>/g //samtools /(\[[^\]]*\])+|(<[^>]*>)+/g     /(\[[^\]]*\])+|(<[^>]*>)+|(\S+)+/g

//

/*lines to ignore*/
var r_ign = [
    /^(\s*\[?\boptions\b:?\]?\s*|\s*\bnotes:\s*|\s*\btips:\s*|\s*\bexamples:\s*)$/gi
]


var save_args = {};

// Parse argv with minimist...it's easier this way.
var argv = require('minimist')(process.argv.slice(2), {
    '--': true
});

// Print usage info
if (!argv['--'].length || argv.help) {
    console.log('Usage:  clihp [-e] -- <command> [arg]...');
    console.log('   -e  get help from stderr (false)');
    process.exit();
}

var args = argv ['--'];
var command = args.shift();

var exec = require('child_process').execFile;

function check_reg(r_m, l) {
    var index = 0;
    var r = r_m.some(function (regexp, i) {
        var r = regexp.test(l);
        index = i;
        regexp.lastIndex = 0;
        return r;
    });
    if (r) {
        return [r, index];
    }
    return false;
}

exec(command, args, function (error, stdout, stderr) {
    var help = "";
    var usage = "";
    var c_args = [];
    var stage = "";
    var tab_c = {len: 0, count: 0};

    if (argv.e || check_reg(r_usage, stderr) || stdout.trim() == "") {
        help = stderr;
    } else {
        help = stdout;
    }

    var lines = help.split('\n');
    for (var index = 0; index < lines.length; index++) {
        var line = lines[index];
        var det;
        if (line.trim() == "") continue;

        if (check_reg(r_ign, line)) {
            stage = "i";
            continue;
        }

        if (check_reg(r_usage, line)) {

            stage = "u";
            usage += (line + "\n");

        } else if ((det = check_reg(r_arg, line))) {

            var match = new RegExp(r_arg[det[1]]).exec(line);
            if (match && match[1]) {
                if (tab_c.len == 0) {
                    tab_c.len = match[1].length;
                    tab_c.count = 1;
                } else if (tab_c.len == match[1].length) {
                    tab_c.count++;
                } else if (tab_c.count < 3) {
                    tab_c.len = match[1].length;
                    tab_c.count = 1;
                }
            }
            stage = "a";
            if (tab_c.count > 3 && tab_c.len != match[1].length) {
                c_args[c_args.length - 1].descr += line.trim() + "\n";
            } else {
                c_args.push({"arg": match[2], "descr": match[3] ? match[3] + "\n" : ""});
                save_args[match[2]] = true;
            }
        } else if (stage == "i") {
            continue;
        } else if (stage == "u") {
            usage += (line.trim() + "\n");
        } else if (stage == "a") {
            c_args[c_args.length - 1].descr += line.trim() + "\n";
        }
    }


    /* Parse usage string to get <files> or undescribed params */

    var u_a = args.filter(function (v) {
        return !(/(^[\-]{0,2}[Hh]$)|(^[\-]{0,2}[Hh]elp$)/g).test(v);
    }).join("|");
    u_a = u_a.length>0?u_a+"|"+command:command;

    var args_f_usage = usage.split("\n")[0].replace(r_usage[0], "").
        replace(new RegExp(u_a, "g"), "").
        replace(/(\s*\[?\boptions\b:?\]?\s*|\s*\bnotes:\s*|\s*\btips:\s*)/gi,"");

    var u_match = args_f_usage.trim().match(r_usage_arg[0]);

    if (u_match && u_match.length > 0) {
        for (var p = 0; p < u_match.length; p++) {
            var match;
            if(r_ign[0].test(u_match[p])) continue;

            match = u_match[p].match(/\[\-{1,2}\w+\]|\-{1,2}\w+$/g); //[-sOsdPdf]
            if (match && match.length == 1) {
                var optional = false;
                match[0].split("").forEach(function (e) {

                    if (e == "[") { optional = true; return; }
                    if (e == "-" || e == "]" || save_args["-"+e]) return;

                    save_args["-"+e] = true;

                    var addarg = {"arg": "-"+e, "descr": ""};
                    addarg['isOptional'] = optional;
                    c_args.unshift(addarg);
                });
                continue;
            }

            var TYPE_FILE = /\bbed\b|\bbam\b|\bbedpe\b|\bvcf\b|\bgff\b|\bfile\d*\b|\b\w+\.\w+\b/gi; //too generic

            match = /\[?([-]{1,2}\w+)\s+\[?(\S+[^\]])\]?/g.exec(u_match[p]); //[-s <outSE.fq>]
            if (match && match.length > 2) {

                if (save_args[match[1]]) continue;

                save_args[match[1]] = true;

                var addarg = {"arg": match[1], "descr": match[2],"position":p+2};
                addarg['isOptional'] = (u_match[p].charAt(0) == "[");
                if (TYPE_FILE.test(match[2])) addarg['type'] = "File";

                c_args.unshift(addarg);
                continue;
            }

            match = u_match[p].match(/\[(\S+)\]|(\S+)/g); //[<outSE.fq>]
            if (match && match.length == 1) {
                var ar = match[0].replace(/[\.<>\*,:\|]/g,"");
                if (save_args[ar]) continue;
                save_args[ar] = true;

                var addarg = {"arg": ar, "descr": match[0], "prefix":false, "position":p+2};
                addarg['isOptional'] = (u_match[p].charAt(0) == "[");
                if (TYPE_FILE.test(match[0])) addarg['type'] = "File";

                c_args.unshift(addarg);
                continue;
            }
        }
    }

    console.log("#!/usr/bin/env cwl-runner");
    console.log(
        "#\n" +
        "# Auto generated CWL please use with caution\n" +
        "# Author: Andrey.Kartashov@cchmc.org (http://orcid.org/0000-0001-9102-5681) / Dr. Barski Lab / Cincinnati Children’s Hospital Medical Center\n" +
        "# Developed for CWL consortium http://commonwl.org/\n"
    );
    var CWL = require('./cwl');
    console.log(CWL({"help": help, "command": command, "args": c_args, "c_args": args}));
    //console.log(usage);
});


//var found = help.match(usage[0]);

//console.log(help.replace(/\n/g,"\\n").replace(/\t/g,"\\t"));

// /\t+[\-]{1,2}\w+\s+.*\n+/gm;

///\t([\-]{1,2}\w+)\s+(.*)\s*/gm, //bedtools
//    /^(\s+|\w+:)\s*([A-Za-z0-9\-_=\[\]]+(, [A-Za-z0-9\-_=\[\]]+)*)\s{2,}(.*)/gm,
//
//    /^\s+([\-]{1,2}\w+(,\s+[\-]{1,2}.*)*)\s+(.*)\s+/gm,
//
//    /(^\s+[\-]{1,2}\w+\s+.*\s*\n)/gm

//var found;

//var found = help.match(usage[0]);
//console.log(found);

//while (match = c_arg[1].exec(help)) {
//    console.log([match[1]]);//,match[2]]);
//    //messages.push(new Message(match, help));
//}


