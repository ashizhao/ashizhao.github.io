/**
 * @require   jQuery lib   
 * @example   
 *       var dlmonObj = new Dlmon('div_id',dlmonOptions);
 *       mapObject.getData();
 *
 *  Some of the options that we can set. (Default values in this case)
 *   this.opts = {
 *       instance: 'ceusn',
 *       stationList : '/api/dlmon/ceusn/stations.json?callback=?',
 *       statusJSON : '/api/dlmon/ceusn/status.json?callback=?',
 *       snet : [],
 *       stations : [],
 *       callAfterUpdate:false,
 *       callAfterInit:false,
 *       refreshsecs : 120,
 *       defaultSort : 1
 *   };
 *
 * @author    Juan Reyes <reyes@ucsd.edu>
 */

var verbose = false;

// We might not use this part... 
//Array.prototype.diff = function(a) {
//    return this.filter(function(i) {return !(a.indexOf(i) > -1);});
//};

var Dlmon = function(div,options) {

    log('Start on div: ' +div );
    // We have many functions that we use from jQuery.
    // Cannot run without it. 
    if (! window.jQuery ) {
        alert('Missing jQuery javascript library.');
        return;
    }

    /* Track globals */

    /* Default values for object.. */
    this.opts = {
        instance: 'ceusn',
        stationList : '/api/dlmon/ceusn/stations.json?callback=?',
        statusJSON : '/api/dlmon/ceusn/status.json?callback=?',
        snet : [],
        rrdpath: '/api/ceusn/rrd/plot/',
        stations : [],
        callAfterUpdate:false,
        callAfterInit:false,
        //refreshsecs : 0,
        defaultSort : 1
    };

    this.data = {};
    this.dlmonID = div;
    this.dlmonDiv = document.getElementById(div); // Div id set on JS-HTML text.
    log('div: '+this.dlmonDiv.id+'  options:'+options); 

    //this.legendID = 'googleLegend'; // not in use for now

    //this.dlmonDivDate = new Date(); // not in use for now

    // All valid fields (columns) on the table. The variable
    // validFields is declare at the end of the file.
    this.fields = Object.keys(validFields).sort();
    this.defaultview = 'dlt,lcq,pb,nr24,dt,dv,da,gp24,tput,ce,nl24,np24,ni24,dr,br24,bw24,cld,clt,gpss,gps,acok,rtm';
    this.defaultview = this.defaultview.split(",");

    // Fields that we want to use, from URL. Defaults to "all" if
    // missing.
    this.useFields = getParameterByName('show');
    //this.useFields = this.useFields ? this.useFields.split(",") : this.fields;
    this.useFields = this.useFields ? this.useFields.split(",") : this.defaultview;
    log('Plot fields: ' + this.useFields);
    
    // Restructure this.fields to plot in correct order.
    //var missing = this.fields.diff( this.useFields );
    //this.fields = this.useFields.concat(missing);

    // Set in URL to define the columns that we want to test for
    // problematic values. Defaults to ['dlt','lcq','pb','nl24'].
    this.sortOrder = getParameterByName('sort');
    this.sortOrder = this.sortOrder ? this.sortOrder.split(",") : ['rtm','dlt','lcq','pb','nl24'];
    log('Final sortOrder:' + this.sortOrder);


    // Populates the headers
    log('call addMenu()');
    this.originalSort = this.sortOrder;
    this.originalFields = this.useFields;
    this.addMenu();


    // Element added to div to keep track of the age of the
    // information on the table. Will have a time text at the end...
    this.dlmonHelpString = $('<p>')
                .html('Last update to information on table:&nbsp;&nbsp;')
                .appendTo(this.dlmonDiv);
    this.dlmonAgeDiv = $('<a>').appendTo(this.dlmonHelpString);

    // Append the main structure of the table
    this.dlmonTableDiv = $('<table>').appendTo(this.dlmonDiv);
    this.dlmonTableHead = $('<thead>').appendTo(this.dlmonTableDiv);
    this.dlmonTableBody = $('<tbody>').appendTo(this.dlmonTableDiv);


    // Combine default values with user submitted values.
    for(var key in options) {
        log('Overwrite defaults from HTML: ' + key + ':  ' + options[key]);
        this.opts[key] = options[key];
    }

    // Final version of the options.
    log(this.opts);
    
    // Build in the background
    this.dlmonTableDiv.hide();

    // Populates the headers
    log('call populateTable()');
    this.populateTable();


    // Gets the data from the server in JSON and creates new rows.
    log('call getData()');
    this.getData();

    // Run function every second to recalc latency values
    log('call updateLatency()');
    updateLatency();

}

Dlmon.prototype.getData = function() {

    log('getData(): ');

    /* Save value for ajax call */
    var t = this;

    $.ajax({
        type: 'GET',
        dataType: "json",
        async: true,
        url: this.opts.statusJSON,
        success: function(data,status,xhr) {

            log('Success on getData():');
            log(data);

            if ( jQuery.isEmptyObject(data) ) {
                var text = 'Not valid response from server.';
                error(text);
                error(xhr.status);
                //alert(text);
                return;
            }

            if ( jQuery.isEmptyObject(t.data) ){
                var first = true;
                log('First run of getData()');
            } else {
                var first = false;
            }

            log('call parseData()');
            t.parseData(data);

            /* refresh all data */
            //if ( t.opts.refreshsecs && t.opts.refreshsecs > 0) {
            //    log('Set auto refresh for getData()');
            //    setTimeout(function(){t.getData();},t.opts.refreshsecs*1000);
            //}

            if ( t.opts.callAfterInit && first ) {
                log('Run callAfterInit() in getData(): ' + t.opts.callAfterInit);
                t.opts.callAfterInit();
            }

            if ( t.opts.callAfterUpdate && ! first) {
                log('Run callAfterUpdate() in getData(): ' + t.opts.callAfterUpdate);
                t.opts.callAfterUpdate();
            }

        },
        error: function(xhr, ajaxOptions, thrownError) {
            //alert('Problems loading data from server.');
            error('getData():  ajax.get('+this.opts.statusJSON+')');
            error(xhr.status);
            error(thrownError);
            error(xhr.responseText);

            /* refresh all data */
            //if ( t.opts.refreshsecs && t.opts.refreshsecs > 0) {
            //    log('Set auto refresh for getData()');
            //    setTimeout(function(){t.getData();},t.opts.refreshsecs*1000);
            //}

        }
    });

}

Dlmon.prototype.sortDATA = function(field,set,missing) {

    log('sortData(): ');

    if ( jQuery.isEmptyObject(this.data) ) {
        error('No information to parse');
        return;
    }

    if ( jQuery.isEmptyObject(missing)  ) {
        error('No information to sort');
        return [set,[]];
    }

    var temp_results = []
    var results = []
    var left_out = [];

    log('set: ' + set);
    log('missing: ' + missing);

    for (var key in missing) {
        var datalogger = missing[key];
        var conversion = this.validField({'online':true,'var':field,'value':this.data[datalogger][field]});
        if( conversion['class'] != 'ok' ) {
            temp_results.push({'key':datalogger,'val':conversion['value']});
        } else {
            left_out.push(datalogger);
        }
    }

    // Sort based on value
    temp_results = temp_results.sort(function (a, b) {
        if ( Number(a.val) && Number(b.val) ) return b.val < a.val;
        else return b.val.localeCompare( a.val );
    });

    for ( var index in temp_results ) {
        results.push(temp_results[index]['key']);
    }

    log('results: ' + results);
    log('left_out: ' + left_out);

    return [set.concat(results),left_out];
}

Dlmon.prototype.parseData = function(json) {

    log('parseData(): ');

    if ( jQuery.isEmptyObject( json ) ) {
        error('No information to parse');
        //alert('No information to parse');
        return;
    }
    
    // copy the data to internal structure
    for (var datalogger in json['instance_status']['dataloggers']) {
        var sta = json['instance_status']['dataloggers'][datalogger]['name'];
        var time = json['instance_status']['dataloggers'][datalogger][
            'oldest_source_timestamp'];
        var info = json['instance_status']['dataloggers'][datalogger]['values'];

        if (! sta ) continue;
        this.data[sta] = info;
        this.data[sta]['time'] = time;
    }

    log('call updateTable()');
    this.updateTable();
}

Dlmon.prototype.updateTable = function() {

    log('updateTable(): ');

    if ( jQuery.isEmptyObject( this.data ) ) {
        error('No stations to build table');
        //alert('No information to build table');
        //$('<h1>No stations on server!!!!</h1>').appendTo(this.dlmonDiv);
        $('<h1>No stations on server!!!!</h1>').prependTo(this.dlmonDiv);
        return;
    }
    
    // Add table last update time to top of table
    var time = new Date() / 1000;
    this.dlmonAgeDiv.html( $('<span>').html(time).hide() ).append('Calculating').addClass('latency');

    // Get list off all stations. Assume they are all good.
    var problematic = [];
    var acceptable = Object.keys(this.data).sort();
    log(acceptable);

    for (var field in this.sortOrder ) {
        field = this.sortOrder[field];

        if ( jQuery.inArray(field,this.useFields) == -1 ) continue;

        // If we want to print a nice name to log use this...
        //var type = this.validField({'var':field,'type':'text'})
        //log('Sort on: ' + type);

        log('Sort on: ' + field);
        var temp = this.sortDATA(field,problematic,acceptable);
        problematic = temp[0];
        acceptable = temp[1];
    }

    // Concat the acceptable ones
    var final_sort = problematic.concat(acceptable);
    log('final_sort: ' + final_sort);

    // Lets hide the table for now.
    this.dlmonTableDiv.hide();

    // clean table.
    this.dlmonTableBody.empty();

    //for (var datalogger in json['instance_status']['dataloggers']) {
    for (var sta in final_sort) {
        sta = final_sort[sta];
        var split = sta.split("_");
        var network = split[0];
        var station = split[1];
        //net = this.data[sta]['snet'];
        log('Now add: ' + sta);

        var tr = $('#'+sta);

        tr = $('<tr>').attr('id',sta);
        tr.appendTo(this.dlmonTableBody);


        if (this.data[sta]['rtm'] < 0 ) {
            var online = false;
            tr.append( $('<td>').text(sta).addClass('bad_name') );
        } else {
            var online = true;
            if ( indexOf.call(problematic,sta) > -1) {
                tr.append( $('<td>').text(sta).addClass('warning_name') );
            } else {
                tr.append( $('<td>').text(sta).addClass('ok_name') );
            }
            //tr.append( $('<td>').text(sta) );
        }

        for (var f in this.fields ) {
            var field = this.fields[f];
            var td = this.validField({'online':online,'var':field,'value':this.data[sta][field]});
            var element = $('<td>').text(td['value']).addClass(td['class']);
            if(td['raw'] ) element.append( $('<span>').html(td['raw']).hide() );

            if( td['rrd'] && this.opts.rrdpath ) {
                var link = '<a target="_blank" href="'+this.opts.rrdpath+'?net='+network+'&sta='+station+'&chan='+td['rrd']+'&tw=m" />';
                element.wrapInner(link);
            } 

            // We are done... append!!
            element.appendTo(tr);
        }

    }

    // Show or hide fields
    this.showHide();

    var sortOrderText = '';
    //for (var f = 0; f < this.sortOrder.length; f++) {
    for (var field in this.sortOrder ) {
        field = this.sortOrder[field];
        if ( jQuery.inArray(field,this.useFields) == -1 ) continue;
        field = validFields[field];
        if ( sortOrderText ) sortOrderText += ', ';
        sortOrderText += field['text'];
    }

    if ( ! sortOrderText ) sortOrderText = ' --NONE-- ';
    $('#sortText').html('Sort on station names THEN bring up any problems on: ' + sortOrderText);

    //if ( this.opts.callAfterUpdate) {
    //    log('Run callAfterUpdate(): ' + this.opts.callAfterUpdate);
    //    window[this.opts.callAfterUpdate]();
    //}

    // Lets show the table now.
    this.dlmonTableDiv.show();
}

Dlmon.prototype.showHide = function() {

    // Show or hide fields
    log('Show fields:' + this.fields);
    log('Use fields:' + this.useFields);

    // Hide all
    $('td').hide();
    $('th').hide();


    // Show station name
    $('td:nth-child(1)').show();
    $('th:nth-child(1)').show();

    for (var f = 0; f < this.useFields.length; f++) {
        var index =  indexOf.call(this.fields,this.useFields[f]);
        if ( index < 0 ) continue;
            index += 2;
            $('td:nth-child('+index+')').show();
            $('th:nth-child('+index+')').show();
    }
}

Dlmon.prototype.addMenu = function() {
    log('addMenu(): ');
    this.dlmonMenuDiv = $('<div>').attr('id',"dlmon_menu").appendTo(this.dlmonDiv);

    // Build menu for subsets
    var t = this;
    $('<button/>').text('Original View') .click( function () { 
        t.useFields = t.originalFields;
        t.sortOrder = t.originalSort;
        t.updateTable();
    }) .appendTo(this.dlmonMenuDiv);
    $('<button/>').text('Masses View') .click( function () { 
        t.useFields = ['m0','m1','m2','m3','m4','m5'];
        t.sortOrder = t.useFields;
        t.updateTable();
    }) .appendTo(this.dlmonMenuDiv);

    // Add area to display sorting options
    $('</br>').appendTo(this.dlmonMenuDiv);
    $('<p/>').attr('id','sortText').appendTo(this.dlmonMenuDiv);

}

Dlmon.prototype.populateTable = function(json) {
    log('populateTable(): ');


    if (! this.fields ) {
        var text = 'No fields selected to build table';
        //alert(text);
        error(text);
        return;
    }

    this.dlmonAgeDiv.html('Unknown last time of update to table info.');

    var tr = $('<tr>')

    /* Add sta name */
    $('<th>').text('Station').addClass("{sorter: 'numeric_parse'}").appendTo(tr);

    for (var f in this.fields ) {
        var field = this.fields[f];
        $('<th>').text(this.validField({'var':field,'type':'text'})).addClass("{sorter: 'numeric_parse'}").appendTo(tr);
    }


    tr.appendTo(this.dlmonTableHead);

}

Dlmon.prototype.validField = function(params) {

    //log('validField(): ');

    /* Format for each object in validFields
     * param = {
     *      'var':nameOfField,
     *      'type':queryType,
     *      'value':dataPoint
     *      }
     */

    if (params['type'] == 'text') {
        // If we only want the field info for the headers

        if (params['var'] in validFields && validFields[params['var']]['text']) {
            return validFields[params['var']]['text'];
        } else {
            return params['var'];
        }

    } else {
        // Parse data values...
        var value = params['value'];
        var online = params['online'] ? true : false;;

        //var rrd = validFields[params['var']]['rrd'] || false;
        //var rrd = params['var'].toUpperCase();
        var rrd = params['var'];

        if ( value ) {
            if ( value == '-') {
                var td = { 'raw':value, 'value':value, 'rrd':rrd, 'class':'none' };
            } else {
                if ( validFields[params['var']]['test'] ) {
                    var test = validFields[params['var']]['test'];
                    var transform = validFields[params['var']]['transform'] ;
                    var ok = validFields[params['var']]['ok'];
                    var warning = validFields[params['var']]['warning'];
                    var validClass = online ? this[test](params['value'],ok,warning) : 'bad';

                    if ( transform ) {
                        var raw = value;
                        value = this[transform](value);
                    }

                    var td = { 'raw':raw, 'value':value, 'rrd':rrd, 'class':validClass };
                } else {
                    var td = { 'raw':value, 'value':value, 'rrd':rrd, 'class':online ? 'none':'bad' };
                }
            }
        } else {
            var td = { 'raw':'-', 'value':'-', 'rrd':rrd, 'class':'none' };
        }

        return td;

    }

}

Dlmon.prototype.testRange = function(value,ok,warning) {

    //log('testRange(): ');
    if ( eval( value + ok ) )  return 'ok';
    if ( warning && eval( value + warning ) )  return 'warning';
    return 'bad';
}

Dlmon.prototype.testValue = function(value,ok,warning) {

    //log('testValue(): ');
    if ( value == ok  )  return 'ok';
    if ( warning && value == warning )  return 'warning';
    return 'bad';
}

Dlmon.prototype.testRegex = function(value,ok,warning) {

    //log('testRegex(): ');
    var ok_val = new RegExp(ok);
    if (value.match(ok_val)) return 'ok';

    var warning_val = new RegExp(warning);
    if (value.match(ok_val)) return 'warning';

    return 'bad';
}

Dlmon.prototype.toInt = function(value) { return rounder(value); }
Dlmon.prototype.toFloat = function(value) { return (value/1).toFixed(1); }
Dlmon.prototype.toFloat2 = function(value) { return (value/1).toFixed(2); }
Dlmon.prototype.toPercent = function(value) { return rounder(value/1)+"%"; }
Dlmon.prototype.toTime = function(value) { return dateRange(value); }
Dlmon.prototype.toTemp = function(value) { return rounder(value)+" C"; }
Dlmon.prototype.toVolt = function(value) { return (value/1).toFixed(1)+" V"; }
Dlmon.prototype.toCurr = function(value) { return (value*100).toFixed(1)+" mA"; }
Dlmon.prototype.toKBytes = function(value) { return (value/1024).toFixed(1)+" Kb"; }
Dlmon.prototype.toMBytes = function(value) { return ((value/1024)/1024).toFixed(1)+" Mb"; }
Dlmon.prototype.toKBytesSec = function(value) { return (value/1024).toFixed(1)+" Kb/s"; }



var rounder = function(val){
    //return Math.round(val*100)/100;
    return Math.round(val);
}

/* If we have console then output some logs. */
var log = function(msg){ 
    if (! verbose ) return;
    if( ! window.console ) return;


    if ( typeof(msg) == "object" ) { 
        console.log('Dlmon():');
        console.dir(msg);
    }
    else {
        console.log('Dlmon():     ' + msg);
    }
};
var error = function(msg){
    if( ! window.console ) return;

    console.log('******   ERROR Dlmon():   ******');

    if ( typeof(msg) == "object" ) { 
        console.dir(msg);
    }
    else {
        console.log(msg);
    }
};

/* If we have console then output some logs. */
var printObject = function(object){
    if (! verbose ) return;
    if ( typeof object == 'undefined' ) {
        console.log('OBJECT NOT DEFINED!');
    } else if ( object.length == 0) {
        console.log('OBJECT IS EMPTY!');
    } else {
        for (property in object) {
            console.log('    ' + property + ': ' + object[property]);
        }
    }
};

var fill2 = function(erg){
    erg = erg + '';
    if (erg.length == 0) erg = "00";            
    if (erg.length < 2) erg = "0" + erg;            

    return erg;
}

var dateRange = function(secs) {

    //log('dateRange: '+ secs);

    if (secs < 0) {
        secs = parseInt( Math.abs(secs) );
        var diff = '-';
    } else {
        secs = parseInt( secs );
        var diff = '';
    }

    var days = Math.floor(secs / (24 * 60 * 60));
    var rest = secs - (days * 24 * 60 * 60);
    var hrs =  Math.floor(rest / (60 * 60));
    rest = rest - (hrs * 60 * 60);
    var min = Math.floor(rest / 60);      
    var secs = secs % 60;

    if (days == 1) diff += days + " Day ";
    if (days > 1) diff += days + " Days ";

    diff += fill2(hrs)+':'+fill2(min)+':'+fill2(secs);

    //log('dateRange: '+ diff);

    return diff;
}

var latency = function(date) {

    var now = new Date();
    return dateRange((now - date) /1000);

}

var updateLatency = function() {

    log('updateLatency');
    $('.latency').each( function () {
        var time = $(this).children().text();
        //log('updateLatency: ' + time);
        if ( time ) {
            var string = latency(new Date(rounder(time*1000)))
            $(this).html( $('<span>').html(time).hide() ).append(string);
        } else {
            $(this).html( $('<span>').html(time).hide() ).append('Problem : '+time);
        }
    });

    setTimeout(function() {updateLatency();}, 5000);

}

function getParameterByName(name) {
    var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function indexOf(needle) {
    if(typeof Array.prototype.indexOf === 'function') {
        indexOf = Array.prototype.indexOf;
    } else {
        indexOf = function(needle) {
            var i = -1, index = -1;

            for(i = 0; i < this.length; i++) {
                if(this[i] === needle) {
                    index = i;
                    break;
                }
            }

            return index;
        };
    }

    return indexOf.call(this, needle);
}

var validFields = {
    "e1a240":{'text':''}, 
    "pkp":{'text':''}, 
    "ce":{
        'text':'Comms Effic',
        'longtext':'Comms efficency as a % of processed to read + mseed pckts',
        'transform':'toPercent',
        'rrd':'QEF',
        'test':'testRange',
        'ok':' > 99 ',
        'warning':' > 0.80 ',
    }, 
    "rtm":{
        'text':'RunTime',
        'longtext':'Running time',
        'transform':'toTime',
        'test':'testRange',
        'ok':' > 0 ',
        'warning':' > -3600',
        'bad':' < 0'
    }, 
    "dbc":{'text':''}, 
    "dbd":{'text':''}, 
    "dbu":{'text':''}, 
    "cld":{
        'text':'Clock Drift',
        'longtext':'Clock drift from true second mark registration.',
        'transform':'toInt',
        'rrd':'LCE',
        'test':'testRange',
        'ok':' == 0'
    },
    "dr":{
        'text':'I/O Rate',
        'longtext':'IO data rate in bits per second',
        'rrd':'QDR',
        'transform':'toKBytesSec',
        'test':'testRange',
        'ok':' > 5000'
    }, 
    "ti":{
        'text':'Baler to VIE',
        'longtext':'Baler44 to VIE. 0-(Not connected)  1-(Connected)'
    }, 
    "clt":{
        'text':'GPS Latency',
        'longtext':'Clock latency - Age of last GPS update',
        'transform':'toTime',
        'rrd':'LCL',
        'test':'testRange',
        'ok':' < 1',
        'warning':' < 3600',
    },
    "e1vco":{'text':''}, 
    "clq":{
        'text':'Clock Stat',
        'longtext':'Clock status',
        'rrd':'LPL'
    },
    "opt":{'text':''}, 
    "lcq":{
        'text':'Clock Quality',
        'longtext':'Percent clock quality',
        'transform':'toPercent',
        'rrd':'LCQ',
        'test':'testRange',
        'ok':' == 100',
        'warning':' > 90 ',
    },
    "dg":{'text':''}, 
    "da":{
        'text':'Current',
        'longtext':'Digitizer current',
        'transform':'toCurr',
        'rrd':'VEC',
        'test':'testRange',
        'ok':' < 0.08',
        'warning':' > 0.04',
    },
    "dv":{
        'text':'Voltage',
        'longtext':'Digitizer voltage',
        'transform':'toVolt',
        'rrd':'VEP',
        'test':'testRange',
        'ok':' > 11 ',
        'warning':' > 9',
    },
    "dt":{
        'text':'Temp',
        'longtext':'Digitizer temperature',
        'transform':'toTemp',
        'rrd':'VKI',
        'test':'testRange',
        'ok':' < 25 ',
        'warning':' < 30',
    },
    "sc1":{'text':''}, 
    "sc0":{'text':''}, 
    "sc3":{'text':''}, 
    "sc2":{'text':''}, 
    "tput":{
        'text':'Thruput',
        'longtext':'Thruput as a ratio of seconds read to the real-time clock',
        'transform':'toFloat',
        'test':'testRange',
        'ok':' > 0.9 ',
        'warning':' > 0.05 ',
    }, 
    "pb":{
        'text':'Buffer Full',
        'longtext':'Percent of datalogger buffer full',
        'transform':'toPercent',
        'rrd':'VPB',
        'test':'testRange',
        'ok':' == 0',
        'warning':' < 75 ',
    }, 
    "pbr":{
        'text':'Buffer Full',
        'longtext':'Percent of datalogger buffer full'
    }, 
    "e1it":{'text':''}, 
    "trb":{'text':''}, 
    "e1wri":{'text':''}, 
    "e1ih":{'text':''}, 
    "trs":{'text':''}, 
    "e1mic":{'text':''}, 
    "e1iv":{'text':''}, 
    "isp1":{'text':''}, 
    "isp2":{'text':''}, 
    "vco":{'text':''}, 
    "dlt":{
        'text':'Latency',
        'longtext':'Data latency - Age of last pckt received',
        'transform':'toTime',
        'rrd':'QDL',
        'test':'testRange',
        'ok':' < 3600',
        'warning':' < 10800',
    }, 
    "gpss":{
        'text':'GPS status',
        'longtext':'GPS status',
        'test':'testRegex',
        'ok':'off|offg|offp|offt|offc|on|ona|onc|cs',
    },
    "e1wpr":{'text':''}, 
    "pkce":{'text':''}, 
    "e1whi":{'text':''}, 
    "acok":{
        'text':'Reserve battery',
        'longtext':'Reserve battery. 0-(ON -or- no VIE)    1-(Normal power)',
        'transform':'toInt',
        'test':'testValue',
        'ok':1,
    },
    "pkse":{'text':''}, 
    "e1wh":{'text':''}, 
    "rssi":{
        'text':'Signal Strength',
        'longtext':'Receive signal strength (Modem radio signal)'
    },
    "rset":{
        'text':'Resets',
        'longtext':'System resets'
    },
    "np24":{
        'text':'24hPOC',
        'longtext':'POCs received in last 24 hours',
        'transform':'toInt',
        'test':'testRange',
        'ok':' >= 1.0'
    },
    "bufr":{
        'text':'Buffer%',
        'longtext':'Percent of datalogger buffer full'
    }, 
    "cme":{
        'text':'Comm Effi',
        'longtext':'Communication efficiency as a percentage of processed to read + missed packets'
    }, 
    "e1wt":{'text':''}, 
    "con":{'text':''}, 
    "e1bar":{'text':''}, 
    "e1ipr":{'text':''}, 
    "api":{
        'text':'Wiring',
        'longtext':'Wiring. 0-(N/A)  1-(Wiring error)'
    }, 
    "e1wdr":{'text':''}, 
    "m5":{'text':''}, 
    "pt":{'text':''}, 
    "cals":{'text':''}, 
    "m0":{
        'text':'mass#1',
        'rrd':'VM1',
        'longtext':'Seismometer mass position #1'
    },
    "m1":{
        'text':'mass#2',
        'rrd':'VM2',
        'longtext':'Seismometer mass position #2'
    },
    "m2":{
        'text':'mass#3',
        'rrd':'VM3',
        'longtext':'Seismometer mass position #3'
    },
    "m3":{
        'text':'mass#4',
        'rrd':'VM4',
        'longtext':'Seismometer mass position #4'
    },
    "m4":{
        'text':'mass#5',
        'rrd':'VM5',
        'longtext':'Seismometer mass position #5'
    },
    "m5":{
        'text':'mass#6',
        'rrd':'VM6',
        'longtext':'Seismometer mass position #6'
    },
    "ecio":{
        'text':'Ec/IO',
        'longtext':'Ec/I0 (Ratio of pilot energy to total PSD)'
    },
    "cale":{'text':''}, 
    "gps":{
        'text':'GPS quality',
        'longtext':'GPS quality',
        'test':'testRegex',
        'ok':'3d',
    }, 
    "meme":{'text':''}, 
    "nrb":{
        'text':'IO Rate',
        'longtext':'Input & output data rate in bits per second'
    },
    "nrs":{'text':''}, 
    "br24":{
        'text':'24h R Bytes',
        'longtext':'Total number of bytes read in last 24 hours',
        'transform':'toMBytes',
        'rrd':'QRD',
        'test':'testRange',
        'ok':' > 70000000',
        'warning':' > 50000000'
    },
    "bw24":{
        'text':'24h W Bytes',
        'longtext':'Total number of bytes written in last 24 hours',
        'transform':'toMBytes',
        'rrd':'QWD',
        'test':'testRange',
        'ok':' > 1000000',
        'warning':' > 500000'
    }, 
    "e1wvr":{'text':''}, 
    "e1wvs":{'text':''}, 
    "gp24":{
        'text':'24h gaps',
        'longtext':'data gaps in last 24 hours',
        'transform':'toTime',
        'rrd':'QGD',
        'test':'testRange',
        'ok':' == 0.0',
    }, 
    "gp1":{
        'text':'1h gaps',
        'longtext':'data gaps in last 1 hour',
        'transform':'toTime',
        'rrd':'QG1',
        'test':'testRange',
        'ok':' == 0.0',
    }, 
    "e1wvh":{'text':''}, 
    "aa":{
        'text':'AA',
        'longtext':''
    }, 
    "inp":{'text':''}, 
    "e1pll":{
        'text':'Clock Stat',
        'longtext':'Clock status.'
    },
    "ni24":{
        'text':'24h IP Cycles',
        'longtext':'Datalogger ip-address changes in last 24 hours',
        'transform':'toInt',
        'test':'testRange',
        'ok':' < 1.0'
    },
    "nl24":{
        'text':'24h Link Cycles',
        'longtext':'Comm link cycles in last 24 hours',
        'transform':'toInt',
        'rrd':'QLD',
        'test':'testRange',
        'ok':' <= 4.0',
        'warning':' < 8.0',
    },
    "e1wsp":{'text':''}, 
    "e1a140":{'text':''}, 
    "nc":{'text':''}, 
    "lat":{
        'text':'Lat',
        'longtext':'GPS reported latitude.',
        'transform':'toFloat2',
        'test':'testRange',
        'ok':' > 0.0',
    },
    "lon":{
        'text':'Long',
        'longtext':'GPS reported longitude',
        'test':'testRange',
        'transform':'toFloat2',
        'ok':' < 0.0',
    },
    "elev":{
        'text':'Elev',
        'longtext':'GPS reported elevetaion',
        'test':'testRange',
        'transform':'toFloat2',
        'ok':' > 0.0',
    },
    "thr":{'text':''}, 
    "pwin":{
        'text':'Board Power',
        'longtext':'Board power in'
    }, 
    "prta":{
        'text':'Ping Millisecs',
        'longtext':'Round trip average of ping packets in milliseconds'
    }, 
    "e1wth":{'text':''}, 
    "sn":{'text':''}, 
    "comt":{
        'text':'Comms Type',
        'longtext':'Communications Type'
    }, 
    "btmp":{
        'text':'Modem Temp',
        'longtext':'Modem board temperature'
    }, 
    "pmp":{
        'text':'Pump',
        'longtext':'Sump pump disposition'
    }, 
    "ins1":{
        'text':'Pump Present',
        'longtext':'Pump existence. 0-(No) 1-(Yes)'
    }, 
    "ins2":{
        'text':'Pump Active',
        'longtext':'Pump activity. 0-(Off) 1-(On)'
    }, 
    "netc":{
        'text':'CDMA Chan',
        'longtext':'CDMA network channel'
    }, 
    "nr24":{
        'text':'24h Reboots',
        'longtext':'Datalogger reboots in last 24 hours',
        'rrd':'QBD',
        'transform':'toInt',
        'test':'testValue',
        'ok':0,
    }
};
