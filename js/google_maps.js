/*
 * Generic Mapping Tool for ANF websistes
 *  
 *  
 *  
 * Global class for our Google maps. 
 * We can init the object with a div
 * that will include the map on our 
 * DOM. Then we can decide if we like
 * to shos stations, events or both.
 *
 * @requires  GoogleMapsAPI v3
 * @requires icon_with_label.js 
 *
 *
 * Juan Reyes
 * reyes@ucsd.edu
 */



/*
 * GLOBAL VARIABLES
 */
var verbose = false; // Set to TRUE for debugging.
var GmapObj = false;  // MAP GLOBAL OBJECT
var hdr = 'ANFmaptool: '; // Prepend log msgs with this tag
var nullcolor = 'FFFAFA';


/* 
 * Generic logging functions
 */
var notify = function(msg){
    printlog( hdr, msg );
};
var log = function(msg){
    if (! verbose ) return;
    printlog( hdr, msg );
};
var error = function(msg){
    printlog( hdr+' ***ERROR*** :', msg );
    alert("ANFmaptool: Something went wrong!");
    throw("ANFmaptool: Something went wrong!");
};
var printlog = function(hdr,msg){
    if(window.console && window.console.log) {
        if (typeof msg == 'number' || typeof msg == 'string' || msg instanceof String){
            console.log(hdr + msg);
        } else {
            console.log(hdr + ' ==>');
            console.dir(msg);
            console.log('<==');
        }
    }
};


// Try to sort by time
//Obj.prototype.sort = function(a, b){
//    if ( typeof(a.time) === 'undefined') {
//        return a.sta == b.sta ? 0 : +(a.sta > b.sta) || -1;
//    } else {
//        return a.time == b.time ? 0 : +(a.time > b.time) || -1;
//    }
//};
//function compare(a,b) {
//    if ( typeof(a.time) === 'undefined') {
//        if (a.sta < b.sta)
//            return -1;
//        if (a.sta > b.sta)
//            return 1;
//        return 0;
//    } else {
//        if (a.time < b.time)
//            return -1;
//        if (a.time > b.time)
//            return 1;
//        return 0;
//    }
//};


// Expand native objets 
//Object.prototype.contains = function(property) {
//    return property in this;
//    //return typeof(this.property) !== undefined;
//};
Array.prototype.contains = function(str) {
    return this.indexOf(str) > -1;
};
String.prototype.contains = function(obj) {
    if ( ! this.length ) return false;
    return this == obj;
};
Array.prototype.insert = function (index, item) {
      this.splice(index, 0, item);
};
Array.prototype.max = function() {
      return Math.max.apply(null, this);
};
String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

var rounder = function(val){
    return Math.round(val*100)/100;
}

var empty = function(obj){
    /* Remove all elements in object */
    try {
        while (obj.hasChildNodes()) {
            obj.removeChild( obj.firstChild );
        }
    } catch(err) {
        //notify("CANNOT EMPTY OBJ: " + obj.id + " " + err);
        // Just continue
    }
}

var isEmpty = function(obj) {
    return Object.keys(obj).length == 0;
};
var isNotEmpty = function(obj) {
    return ! isEmpty(obj);
};

var addDiv = function(id,newClass,appendTo){
    /* Create a new DIV in DOM */
    var div = document.createElement('div');

    if (id) div.id = id;
    if (newClass) div.className = newClass;
    if (appendTo) document.getElementById(appendTo).appendChild(div);

    return div;
}

// Sometimes we need the extra 0 during time formats
var fill2 = function(erg){
    erg = erg + '';
    if (erg.length == 0) erg = "00";            
    if (erg.length < 2) erg = "0" + erg;            

    return erg;
}


// Usefull time functions
var ageSecs = function(lastUpdate) {
    /* Calc age in seconds for this time */
    return (new Date() - (lastUpdate * 1000) ) /1000;
}

var getlatency = function(test) {
    /* Calculate how old is the
     * date object passed to this
     * function. Return a string.
     */

    test *= 1000;
    var now = new Date().getTime();

    return parseInt( (now - test) /1000);
}

var latency = function(test) {
    /* Calculate how old is the
     * date object passed to this
     * function. Return a string.
     */

    var now = new Date().getTime();

    if (test > now) {
        var secs = parseInt( (test - now) /1000);
        var diff = '-';
    } else {
        var secs = parseInt( (now - test) /1000);
        var diff = '';
    }

    if ( isNaN(secs) ) return '';

    var days = Math.floor(secs / (24 * 60 * 60));
    var rest = secs - (days * 24 * 60 * 60);
    var hrs =  Math.floor(rest / (60 * 60));
    rest = rest - (hrs * 60 * 60);
    var min = Math.floor(rest / 60);
    var secs = secs % 60;

    if (days == 1) diff += days + " Day ";
    if (days > 1) diff += days + " Days ";

    diff += fill2(hrs)+':'+fill2(min)+':'+fill2(secs);

    return diff;
}

     
/* 
 * Main class object
 */
var GoogleMap = function(mapid,options) {


    this.initDate = new Date();

    this.mapDiv =  document.getElementById(mapid);
    if (! this.mapDiv || typeof this.mapDiv == "undefined")  error("Cannot find specified id in DOM!");
    log('init: '+this.mapDiv.id);
    log(options);

    this.mapDiv.className = this.mapDiv.className + " google_map";

    //this.fade = 'out'; // control fade in/out operation
    //this.opacity = 1.0; // control fade in/out operation
    //this.rate = 120;
    //this.step = 0.05;
    //this.min_fade = 0.2;
    //this.max_fade = 1.0;

    // Control plotting of stations
    this.active = false;
    this.type = false;
    this.param = false;
    this.displayOnly = new Object(); // Subset map to only entries of some type
    this.displayStatus = false; // Subset map to only entries of some type

    this.anaglyph = false;
    this.anaglyph_invert = true;

    this.styleBuffer = new Object(); // Keep track of each colored element
    this.colorHide = new Object(); // Keep track of each colored element

    this.datacache =  new Object();

    /* Default values for out map.. */
    this.map_config = {
        holdMap: false,                 // No autobound map
        showStatus: true,               // Avoid shoing online/offline status
        bannerURL : '/images/usarray_v2.gif',
        iconInfoURL : 'infowindow.php', // Set to false to open dialog box
        tableInfoURL : '/stations', // Set to false to open dialog box
        displayErrors : false,
        displayNames : false,
        stationIconSize : 10,
        markersize : false,
        markeredge : false,
        markercolor : false,
        snet : [],
        refreshSecs : 0,
        iconapi : '/api/ta/mapimg/',
        initZoom : 5,
        defaultLocation : [38.0, -87.0],
        panIcons: {
            'Low48' : { 'lat':39, 'lon':-95, 'zoom':5},
            'Alaska' : { 'lat':65, 'lon':-150, 'zoom':4},
            'Cascadia' : { 'lat':44.5, 'lon':-122.5, 'zoom':6}
        },
        display_types: [
            {value: "snet", text: "Network", selected:true},
            {value: "vnet", text: "VirtualNet", selected:false},
            {value: "commtype", text: "CommType", selected:false},
            {value: "provider", text: "Provider", selected:false},
            {value: "digitizer", text: "Digitizer", selected:false},
            {value: "sensor", text: "Sensor", selected:false}
        ],
        statusOptions: [
            {value: 1, text: "Active", selected:true},
            {value: 0, text: "Decom", selected:false}
        ]

    };


    /* Combine default values with user submitted values. */
    for(var key in options) {
        log('overwrite defaults: ' + key + ':  ' + options[key]);
        this.map_config[key] = options[key];
    }

    
    // fix defaultLocation
    if ( this.map_config.defaultLocation ) {
        this.map_config.defaultLocation = new google.maps.LatLng(
            this.map_config.defaultLocation[0],
            this.map_config.defaultLocation[1]);
        this.map_config.autoBox = false;
    } else {
        this.map_config.defaultLocation = new google.maps.LatLng( 38.0, -87.0 );
        this.map_config.autoBox = true;
    }


    //this.openinfowindow = false;

    this.statusSelect = Object(); // save the dorpdown elements on the variables
    this.typeSelect = Object();   // save the dorpdown elements on the variables


    this.table =  false;
    this.tableDiv =  false;

    this.eventsrc = '';
    this.stationsrc = '';
    this.statuslegend = false;
    this.statuslegendID = 'googleStatoinLegend';

    this.eventlegend = false;
    this.eventlegendID = 'googleEventLegend';
    this.legend = false;
    this.legendID = 'googleLegend';
    this.controlsID = 'googleOverlayControl';
    this.coordBoxID = 'googleCoordBox';

    this.problemdiv = false;
    this.problemdivID = 'googleProblemDiv';

    this.ANFlogo = false;

    /* Fix location of marks to be on top of lat,lon */
    this.map_config.markermiddle = this.map_config.stationIconSize/2;

    this.eventconfig= {
        'red':{ 'text':'< 6 hrs', 'zindex': 9 },
        'orange':{ 'text':'6-12 hrs', 'zindex': 8 },
        'yellow':{ 'text':'12-24 hrs', 'zindex': 7 },
        'yellowgreen':{ 'text':'1-3 days', 'zindex': 6 },
        'steelblue':{ 'text':'3-7 days', 'zindex': 5 },
        'lightblue':{ 'text':'> 7 days', 'zindex': 4 }
    };

   // Create a new StyledMapType 
    // http://gmaps-samples-v3.googlecode.com/svn/trunk/styledmaps/wizard/index.html
    // Create a new StyledMapType object, passing it the array of styles,
    // as well as the name to be displayed on the map type control.
    this.MapStyles = [ 
        {
            "featureType": "water",
            "stylers": [
                { "visibility": "simplified" },
                { "color": "#808080" },
                { "lightness": 39 }
            ]
        },
        {
            "featureType": "landscape.man_made",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "landscape.natural.landcover",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "landscape.man_made",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "poi",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "road",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "transit",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "landscape.natural",
            "stylers": [
                { "visibility": "simplified" },
                { "color": "#FFFFFF" }
            ]
        }
    ];
    var SIMPLE = new google.maps.StyledMapType(this.MapStyles,
        {name: "Basic"});
        
 

    // Create a new StyledMapType object, passing it the array of styles,
    // as well as the name to be displayed on the map type control.
    this.AnaglyphMapStyles = [ 
        {
            "featureType": "water",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "administrative.country",
            "stylers": [ { "visibility": "on" } ]
        },
        {
            "featureType": "landscape.man_made",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "landscape.natural.landcover",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "landscape.man_made",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "poi",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "road",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "transit",
            "stylers": [ { "visibility": "off" } ]
        },
        {
            "featureType": "landscape.natural",
            "stylers": [
                { "visibility": "simplified" },
                { "color": "#FFFFFF" }
            ]
        }
    ];
    this.ANAGLYPHSTYLE = 
        new google.maps.StyledMapType(this.AnaglyphMapStyles, {name: "Anaglyph"});

    var mapOptions = {
        zoom: this.map_config.initZoom,
        scaleControl: true,
        center: this.map_config.defaultLocation,
        mapTypeControlOptions: {
            mapTypeIds: [
                google.maps.MapTypeId.ROADMAP,
                google.maps.MapTypeId.TERRAIN,
                google.maps.MapTypeId.SATELLITE,
                google.maps.MapTypeId.HYBRID,
                'blackAndWhite'
                ],
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_LEFT
        },
        zoomControl: true,
        scrollwheel:false,
        zoomControlOptions: {
            style:google.maps.ZoomControlStyle.SMALL,
            position: google.maps.ControlPosition.LEFT_TOP
        }, 
        streetViewControl: false,
    };


    /* Init Google Map object */
    this.map = new google.maps.Map(this.mapDiv, mapOptions); 
    this.map.mapTypes.set('blackAndWhite', SIMPLE);
    this.map.setMapTypeId('blackAndWhite');

    /* Global declaration of the infowindow */
    this.iw = new google.maps.InfoWindow();

    /* Set default values for future Ajax requests */
    $.ajaxSetup({
        type: 'GET',
        dataType: "json",
        async: true,
        error: function(xhr, ajaxOptions, thrownError) {
            this.setWarning();
            log('ajax.get('+file+')');
            log(xhr.status);
            log(thrownError);
            log(xhr.responseText);
            error('Problems loading data from server.');
        }
    });

    $(document).bind("ajaxError", function(){
        error('Problems loading data from server.');
    });

    /* Run function regularly to recalc latency values */
    this.updateLatency(); // only want to run once.

    /* Run function regularly to blink offline sites */
    //this.fadeToggle(); // only want to run once.

    this.addPanShortcuts();

    // Send itself to a global variable. Then we
    // can call it async from anonymous functions.
    GmapObj = this;
}


GoogleMap.prototype.setAutoRefresh = function( t_sec, datatype, url) {

    if ( datatype == 'stations' ) file = GmapObj.stationsrc = url;
    else file = GmapObj.eventsrc = url;

    this.map_config.refreshSecs = t_sec;
    this.handleAutoRefresh( 'setup' );
}

GoogleMap.prototype.setAnaglyph = function() {
    this.anaglyph = true;
    this.map_config.refreshSecs = 0;
    this.map.mapTypes.set('anaglyph', this.ANAGLYPHSTYLE);
    this.map.setMapTypeId('anaglyph');
}

GoogleMap.prototype.addStations = function(file,tableDiv) {

    log('addStations(): ' + file);

    if ( ! file ) return;
    else GmapObj.stationsrc = file;

    try {
        GmapObj.tableDiv =  document.getElementById(tableDiv);
    } catch(err) {
        notify('CANNOT FIND TABLE DIV: ' + tableDiv);
    }

    this.addStationControlBox();
    this.addstatuslegend();
    this.getNewData('stations');
    this.handleAutoRefresh( 'setup' );

}

GoogleMap.prototype.addEvents = function(file,tableDiv) {

    log('addEvents(): ' + file);

    if ( ! file ) return;
    else GmapObj.eventsrc = file;

    try {
        GmapObj.tableDiv =  document.getElementById(tableDiv);
    } catch(err) {
        notify('CANNOT FIND TABLE DIV: ' + tableDiv);
    }

    this.addEventLegend();
    this.getNewData('events');
    this.handleAutoRefresh( 'setup' );

}

GoogleMap.prototype.addStaticEvents = function(data,tableDiv) {

    log('addStaticEvents(): ');
    try {
        GmapObj.tableDiv =  document.getElementById(tableDiv);
    } catch(err) {
        notify('CANNOT FIND TABLE DIV: ' + tableDiv);
    }

    GmapObj.now = (new Date).getTime();
    GmapObj.type = 'events' ;
    this.addEventLegend();
    this.plotData(data)

}

GoogleMap.prototype.addStaticStations = function(data,tableDiv) {

    log('addStaticStations(): ');

    try {
        GmapObj.tableDiv =  document.getElementById(tableDiv);
    } catch(err) {
        notify('CANNOT FIND TABLE DIV: ' + tableDiv);
    }

    GmapObj.now = (new Date).getTime();
    GmapObj.type = 'stations' ;
    this.addStationControlBox();
    this.addstatuslegend();
    this.plotData(data)


}


GoogleMap.prototype.handleAutoRefresh = function( justInit ) {

    log('handleAutoRefresh: ' + justInit );
    if ( ! GmapObj.map_config.refreshSecs ) return; // don't do autorefresh

    // Need a way to call the autorefresh from outside
    // this object and have no variable deps.o
    if ( justInit ) {
        log('handleAutoRefresh:  first load');
        log('stationsrc:  ' + GmapObj.stationsrc);
        log('eventsrc:  ' + GmapObj.eventsrc);
    } else {
        log('handleAutoRefresh:  get more data');
        log('stationsrc:  ' + GmapObj.stationsrc);
        log('eventsrc:  ' + GmapObj.eventsrc);
        if ( GmapObj.stationsrc ) GmapObj.getNewData('stations');
        if ( GmapObj.eventsrc ) GmapObj.getNewData('events');
    }

    log('Set AutoRefresh to : ' + GmapObj.map_config.refreshSecs  + ' secs' );
    setTimeout(GmapObj.handleAutoRefresh, GmapObj.map_config.refreshSecs * 1000);
}

GoogleMap.prototype.getNewData = function(datatype) {

    log('getNewData(): ' + datatype);

    GmapObj.type = datatype;
    GmapObj.now = (new Date).getTime();

    if ( datatype == 'stations' ) file = GmapObj.stationsrc;
    else file = GmapObj.eventsrc;


    $.ajax({
        url: file,
        success: function(data,status,xhr){
            log('ajax.get('+file+') => success');
            log(xhr.status);
            GmapObj.plotData(data)
        }
    });

}


GoogleMap.prototype.cleanMapCache = function() {
    /* Remove all elements from DOM
     * and get it ready for new loop.
     * We want to avoid memory problems
     * with this tool.
     */

    log('clean(): ');

    // Empty all elements inside the table div
    empty( this.tableDiv );
    //recursiveDelete( this.tableDiv );
    delete( this.table ); // Need new object

    //for (i = 0; i < this.datacache.length; i+= 1) {
    for (var i in this.datacache) {
        if ( 'icon' in this.datacache[i] ) {
            try {
                this.datacache[i]['icon'].setMap(null);
                this.datacache[i]['icon'].unbindAll();
                google.maps.event.clearInstanceListeners( this.datacache[i]['icon'] );
                this.datacache[i]['icon'] = null;
            } catch(err) {
                //notify('Problems during cleanning of map: ' + err);
            }
        }
        if ( 'label' in this.datacache[i] ) {
            try {
                this.datacache[i]['label'].setMap(null);
                this.datacache[i]['label'].unbindAll();
                google.maps.event.clearInstanceListeners( this.datacache[i]['label'] );
                this.datacache[i]['label'] = null;
            } catch(err) {
                //notify('Problems during cleanning of map: ' + err);
            }
        }
    }


}


GoogleMap.prototype.setPlotType = function() {
    log('setPlotType(): ');

    /* Cleanup before we start */
    this.styleBuffer = new Object();
    this.colorHide = new Object();

    // Save values to global variables.
    this.active = this.statusSelect.value;
    this.param = this.typeSelect.value;

    if (typeof this.param == 'undefined') this.param = 'snet';

    if (this.type == 'stations') {

        if (this.param == 'snet') {
            this.style = network;
        } else if (this.param == 'sensor') {
            this.style = sensor;
        } else if (this.param == 'digitizer') {
            this.style = digitizer;
        } else if (this.param == 'provider') {
            this.style = providers;
        } else if (this.param == 'commtype') {
            this.style = comms_type;
        } else if (this.param == 'vnet') {
            this.style = vnet;
        } else {
            this.style = network;
        }
    } else {
        //overwrite value
        this.param = 'time';
    }

}

GoogleMap.prototype.plotData = function( data ) {

    log('plotData(): ');

    // START FROM ORIGINAL...
    this.cleanMapCache(); // Call here in case we are refreshing the map
    this.datacache = new Object(); // Keep an array of objects plotted

    if (this.problemdiv) this.problemdiv.empty;

    // Run this if we have an empty map
    if ( data.length ) {
        // New new objects
        for (key = 0; key < data.length; key+= 1) {
            var site = this.parseData(data[key]);
            if ( ! 'lat' in site || ! 'lon' in site ) {
                this.problemSite( site.id );
                notify('Problems plotting location: ' + site.id)
                continue;
            }

            // Might have full location //  NOT DONE HERE....
            //site.lat = ('latlat' in site) ? site.latlat : site.lat ; 
            //site.lon = ('lonlon' in site) ? site.lonlon : site.lon ; 

            this.datacache[site.id] = site ;
        }
    }

    this.plotItemsClean();
};

GoogleMap.prototype.plotItemsClean = function( ) {
    // Remove all filters. Start new plot

    this.displayOnly = new Object(); // Empty filter
    this.displayStatus = false; // Empty filter
    this.plotItems();
    if ( this.legend ) this.legend.className = 'googleControl';
    if ( this.statuslegend ) this.statuslegend.className = 'googleControl';
    if ( this.eventlegend ) this.eventlegend.className = 'googleEventControl';

}

GoogleMap.prototype.plotItems = function( ) {

    log('plotItems(): ');

    // First we need to get the configuration
    // that we are using for plotting. Some
    // cleanup too.
    this.setPlotType();

    // Just refresh the objects that we already have
    this.cleanMapCache();

    this.bounds = new google.maps.LatLngBounds();

    var plotting_now = 0; // track total


    //this.datacache.sort(function(a, b){
    //    if ( typeof(a.time) === 'undefined') {
    //        return a.sta == b.sta ? 0 : +(a.sta > b.sta) || -1;
    //    } else {
    //        return a.time == b.time ? 0 : +(a.time > b.time) || -1;
    //    }
    //});

    // Add station icon to map and entry to table
    for (var id in this.datacache) {

        // Plot online or offline?
        if ( typeof this.active === "undefined" || this.active  == this.datacache[id].active ) {
            //log('Try adding icon: ' + id);

            // Maybe we don't want to put closed stations
            // if we don't have the select menu defined.
            if ( typeof this.active === "undefined" &&  ! this.datacache[id].active ) continue;

            // Find color of icon and track instances of each...
            this.datacache[id].color = 
                this.getColor(this.datacache[id][this.param]);

            if ( ! Array.isArray(this.datacache[id].color )  )
                this.datacache[id].color = this.datacache[id].color.split(",");

            // Maybe we are filtering the display...
            if ( this.displayStatus && 
                    this.datacache[id].status !== this.displayStatus )
                        continue;
            if ( isNotEmpty(this.displayOnly) && 
                    ! this.displayOnly[this.datacache[id].color] )
                        continue;

            // Find color of icon and track instances of each...
            this.datacache[id].zindex = (this.type == 'stations') ?
                this.getZindex(this.datacache[id][this.param]) :
                this.getZindex(this.datacache[id].color);


            this.datacache[id].icon = this.newIcon( this.datacache[id] );
            this.datacache[id].label = this.newLabel( this.datacache[id] );

            this.addToTable( this.datacache[id] );

            plotting_now += 1;
            this.bounds.extend( this.datacache[id].icon.position );
        }
    }

    // Do we move the map window?
    if ( ! this.map_config.holdMap ) {
        if ( ( isNotEmpty(this.displayOnly) || this.displayStatus ) && plotting_now ) {
            this.map.fitBounds( this.bounds );
        } else {
            if ( this.map_config.autoBox ) {
                this.map.fitBounds( this.bounds );
            } else {
                this.map.setZoom( this.map_config.initZoom );
                this.map.setCenter( this.map_config.defaultLocation );
            }
        }
    }


    //if ( plotting_now < 1 ) alert( 'Nothing to plot!!!' );

    this.updateLegend();
};


GoogleMap.prototype.addStationSelectBox = function(id,elements) {
    // ADD SELECT FOR ACTIVE OR DECOMM STATUS
    var select = document.createElement('select');
    select.id = id;
    select.style.margin = '4px';

    for (i = 0; i < elements.length; i+= 1) {
        var optionSelect = document.createElement('option');
        optionSelect.text = elements[i]['text'];
        optionSelect.value = elements[i]['value'];
        optionSelect.selected = elements[i]['selected'];
        if ( elements[i]['selected'] ) {
            optionSelect.selected = 'selected' ;
            //this[id] = elements[i]['value'];
        }
        select.appendChild(optionSelect);
    }

    return select;
}

GoogleMap.prototype.addPanShortcuts = function() {

    // Pan - Zoom buttons on top right of map
    for (var key in this.map_config.panIcons ) {
        if (! this.map_config.panIcons.hasOwnProperty(key)) continue;
        //notify(key);
        var control = addDiv(key, 'googlePanZoomControl',false);
        control.innerHTML = key;
        control.index = 1;

            //google.maps.event.addDomListener(control, 'click', function() {
        // When the button is clicked do stuff
        //this.map_config.panIcons[key]['icon'] =
            //google.maps.event.addListener(control, 'click', function() {
        control.addEventListener("click", function() {
                var key = this.id;
                log('Click on shortcut key: ' + key);
                GmapObj.map.panTo( new google.maps.LatLng( 
                            GmapObj.map_config.panIcons[key]['lat'],
                            GmapObj.map_config.panIcons[key]['lon'] ) );

                GmapObj.map.setZoom( GmapObj.map_config.panIcons[key]['zoom'] );
            });

        // Add the control to the map
        this.map.controls[google.maps.ControlPosition.RIGHT_TOP].push(control);
    }

}

GoogleMap.prototype.addStationControlBox = function() {

    /* We already have one. Just make it visible. */
    if (this.stationControlBox) return;

    // Dropdown menu
    this.stationControlBox = addDiv(this.controlsID,'googleDisplayTypeControl',false);
    //this.stationControlBox.style.display = 'none';
    this.stationControlBox.title = 'Change Display Type';
    this.stationControlBox.index = 1;


    if ( this.map_config.statusOptions.length ) {
        // ADD SELECT FOR ACTIVE OR DECOMM STATUS
        this.statusSelect = this.addStationSelectBox('statusOption',this.map_config.statusOptions);
        this.stationControlBox.appendChild(this.statusSelect);
        this.statusSelect.addEventListener("change", this.plotItemsClean.bind(this));
    }
    
    if ( this.map_config.display_types.length ) {
        // ADD SELECT FOR STATION PARAMETER TO PLOT
        this.typeSelect = this.addStationSelectBox('typeOption',this.map_config.display_types);
        this.stationControlBox.appendChild(this.typeSelect);
        this.typeSelect.addEventListener("change", this.plotItemsClean.bind(this));
    }

    this.map.controls[ google.maps.ControlPosition.TOP_RIGHT].push(this.stationControlBox);
}


GoogleMap.prototype.addCoordBox = function() {

    /* We already have one */
    if (this.coordBox) return;

    /* Location box */
    //var startLat = rounder(this.map.getCenter().lat());
    //var startLng = rounder(this.map.getCenter().lng());

    this.coordBox = addDiv(this.coordBoxID,'googleControl',false);
    this.coordBox.style.margin = '5px';

    var none = '//anf.ucsd.edu/api/ta/mapimg/?shape=none&status=';
    var trig = '//anf.ucsd.edu/api/ta/mapimg/?shape=triangle&status=';
    var pentagon = '//anf.ucsd.edu/api/ta/mapimg/?shape=pentagon&status=';
    var text = '' ;
    //var text = '' +
    //    '<strong>Location:</strong>' +
    //    '<span id="currentCoords">'+
    //    startLat + "N, "+
    //    startLng + "E"+
    //    '</span></br>';

    text += '<table>' + 
        '<tr>' +
        '<td>warning</td>'+ '<td><img src="'+none+'warn&size=25"></td>'+
        '</tr>' +
        '<tr>' +
        '<td>offline</td>'+ '<td><img src="'+none+'fail&size=25"></td>'+
        '</tr>' +
        '</table>' +
        '<hr>' +
        '<table>' +
        '<tr>' +
        '<td>broadband</td>'+ '<td><img src="'+trig+'pass&size=15"></td>'+
        '</tr>' +
        '<tr>' +
        '<td>strong-motion</br>broadband</td>'+ '<td><img src="'+pentagon+'pass&size=15"></td>'+
        '</tr></table>';

    this.coordBox.innerHTML = text;

    this.map.controls[ google.maps.ControlPosition.LEFT_BOTTOM].push(this.coordBox);

    // Mousemove for Lat,Lon
    //google.maps.event.addListener(this.map, 'mousemove', function(e) {
    //    var myLat = e.latLng.lat();
    //    var latStr = (Math.round(myLat*100)/100).toString();
    //    var myLng = e.latLng.lng();
    //    var lngStr = (Math.round(myLng*100)/100).toString();
    //    var element = document.getElementById("currentCoords");
    //    if ( element ) element.innerHTML = latStr+"N, "+lngStr+"E";
    //});

}

GoogleMap.prototype.setWarning = function() {

    log('setWarning');
    if (! this.legend) return;
    this.legend.className += " googleControlWarning";

}


GoogleMap.prototype.addANFlogo = function() {

    /* We already have one */
    if (this.ANFlogo) return;

    this.ANFlogo = addDiv('ANFlogo','googleProjectBanner',false);
    this.ANFlogo.innerHTML = '<img src="' + this.map_config.bannerURL + '">';
    this.map.controls[google.maps.ControlPosition.TOP_CENTER].push(this.ANFlogo);

}

//GoogleMap.prototype.fadeToggle = function() {
//    // blink the icons
//    //notify('fadeToggle: opacity=' + this.opacity);
//    if ( this.map_config.blink_offline) {
//
//        if ( this.fade == 'out' ) this.opacity = this.opacity - this.step;
//        else this.opacity = this.opacity + this.step;
//
//        if ( this.fade == 'out' && this.opacity <= this.min_fade ) {
//            this.fade = 'in';
//            this.opacity = this.min_fade;
//        }
//        if ( this.fade == 'in' && this.opacity >= this.max_fade ) {
//            this.fade = 'out';
//            this.opacity = this.max_fade;
//        }
//
//        for (sta = 0; sta < this.datacache.length; sta+= 1) {
//            if ( this.datacache[sta].status == 'offline' && this.datacache[sta].icon ) {
//                this.datacache[sta].icon.setOpacity( this.opacity );
//            }
//        }
//    }
//
//    setTimeout(function() {GmapObj.fadeToggle();}, this.rate);
//}

GoogleMap.prototype.updateLatency = function() {
    /* This function will update the latency
     * string for every object defiend with
     * that class: "latency"
     * Run every second. May be set to less.
     */

    var elements = document.getElementsByClassName('latency');

    for (var i = 0; i < elements.length; ++i) {
        var item = elements[i];
        try{
            var time = item.getElementsByTagName('input')[0].value;
        } catch(err) {
            continue;
        }
        var string = latency(time);
        if ( string ) {
            item.innerHTML='<input type="hidden" value="'+time+'" />'+ string ;
        } else {
            item.innerHTML= 'Problem calculating latency. [' + time + ']' ;
        }
    };


    setTimeout(function() {GmapObj.updateLatency();}, 1000);
}

GoogleMap.prototype.addstatuslegend = function() {

    /* We already have one */
    if (this.statuslegend) return;
    if (! this.map_config.showStatus) return;

    var url = this.map_config.iconapi+'?'+'size='+this.map_config.stationIconSize;
    var online = url + '&status=online';
    var warning = url + '&status=warning';
    var offline = url + '&status=offline';


    this.statuslegend = addDiv(this.statuslegendID,'googleStationControl',false);

    // New table for legend
    var t=false,h=false,r=false, c=false;
    t= document.createElement('table');

    // Need header
    h = t.createTHead();
    r = h.insertRow(-1); 
    c = r.insertCell(-1);
    c.colspan = 2;
    c.innerHTML = 'STATUS';

    var options = { 'online': online, 'warning':warning, 'offline':offline };
    for (var stat in options) {
        // Need body
        b = t.createTBody();
        r = b.insertRow(-1); 
        r.id = stat;
        c = r.insertCell(-1);
        c.innerHTML = '<img src="'+options[stat]+'">';
        c = r.insertCell(-1);
        c.innerHTML = stat;

        // Add some click listener to them.
        r.addEventListener("click",  function() {
            if ( GmapObj.displayStatus && GmapObj.displayStatus === this.id ) {
                GmapObj.displayStatus = false;
                document.getElementById("online").style.background = '';
                document.getElementById("warning").style.background = '';
                document.getElementById("offline").style.background = '';
                GmapObj.statuslegend.className = 'googleStationControl';
            } else {
                document.getElementById("online").style.background = '';
                document.getElementById("warning").style.background = '';
                document.getElementById("offline").style.background = '';
                document.getElementById(this.id).style.background = 'red';
                GmapObj.displayStatus = this.id;
                GmapObj.statuslegend.className = 'googleStationControl googleControlActive';
            }

            GmapObj.plotItems();
        });
    }

    this.statuslegend.appendChild(t);

    this.map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(this.statuslegend);
}

GoogleMap.prototype.problemSite = function(text) {

    log('add ' + text + ' to list');

    if ( ! this.map_config.displayErrors) return;

    /* We already have one */
    if ( ! this.problemdiv ) {
        var div = addDiv(this.problemdivID,'googleControlWarning',false);
        // New table for legend
        var t=false,h=false,r=false, c=false;
        t= document.createElement('table');
        r = t.insertRow(-1); 
        c = r.insertCell(-1);
        c.innerHTML = 'MISSING ON MAP:';
        r = t.insertRow(-1); 
        this.problemdiv = r.insertCell(-1);

        div.appendChild(t);

        this.map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(div);
    }

    this.problemdiv.textContent = text + ' ' + this.problemdiv.textContent;

}

GoogleMap.prototype.addEventLegend = function() {

    /* We already have one */
    if (this.eventlegend) return;

    this.eventlegend = addDiv(this.eventlegendID,'googleEventControl',false);

    // New table for legend
    var t=false,h=false,r=false, c=false;
    t= document.createElement('table');
    b = t.createTBody();
    r = b.insertRow(-1); 


    //var eventlegend = '<table><tr>' ; 

    for ( var color in this.eventconfig ) {
        if (! this.eventconfig.hasOwnProperty(color)) continue;
        c = r.insertCell(-1);
        c.style.background = color;
        c.id = color;
        c.innerHTML = this.eventconfig[color]['text'];
        //
        // Add some click listener to them.
        c.addEventListener("click",  function() {
            if ( isNotEmpty( GmapObj.displayOnly ) && GmapObj.displayOnly[this.id] ) {
                delete GmapObj.displayOnly[this.id]; 
                if ( isEmpty(GmapObj.displayOnly) ) GmapObj.eventlegend.className = 'googleEventControl';
            } else {
                GmapObj.displayOnly[this.id] = true;
                GmapObj.eventlegend.className = 'googleEventControl googleControlActive';
            }

            GmapObj.plotItems();
        });
    }
    this.eventlegend.appendChild(t);


    this.map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(this.eventlegend);


}

GoogleMap.prototype.updateLegend = function() {

    //notify('updateLegend()');

    if (! this.legend) {
        this.legend = addDiv(this.legendID,'googleControl',false);
        this.legend.style.margin = '10px';

        this.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(this.legend);
    }


    empty( this.legend );

    // Add default text with data latency.
    this.legend.innerHTML = '<p style="margin:0 auto;padding:0;"><strong>'+
        'Last Update:</strong></p>' +
        '<div class="latency"><input type="hidden" value="'+this.now+'" />-</div>';

    // ONLY if we have sites on map
    //if ( this.datacache.length && this.type == 'stations') {
    if ( this.type == 'stations') {

        // New checkbox for map

        // Add checkbox for MAP FITBOUNDS HOLD
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.name = 'Hold Map';
        cb.id = 'holdMap';
        cb.checked = this.map_config.holdMap;
        this.legend.appendChild(cb);
        // New label for checkbox
        var label = document.createElement('label')
        label.htmlFor = 'holdMap';
        label.innerHTML = 'Hold Map';
        this.legend.appendChild(label);
        // Add some click listener to the checkbox
        cb.addEventListener("click",  function() {
            
            try {
                GmapObj.map_config.holdMap = document.getElementById("holdMap").checked ;
            } catch(err) {
                GmapObj.map_config.holdMap = false;
            }
        });



        // New table for legend
        var t=false,h=false,r=false, c=false;
        t= document.createElement('table');

        // Need header
        h = t.createTHead();
        r = h.insertRow(-1); 
        c = r.insertCell(-1);
        c.innerHTML = this.typeSelect.value;
        c = r.insertCell(-1);
        c.innerHTML = 'Total';


        // Need body
        b = t.createTBody();

        var sorted = [];
        for (k in this.styleBuffer) sorted.push(k);
        sorted.sort();
        for (var i = 0; i < sorted.length; ++i) {
            var key = sorted[i];
            var color = Object.keys(this.styleBuffer[key])[0];
            var total = this.styleBuffer[key][color];

            r = b.insertRow(-1); 
            c = r.insertCell(-1);
            c.innerHTML = key;
            c.id = color;

            // Maybe we want to limit the background colors...
            if ( isNotEmpty(this.displayOnly) && ! this.displayOnly[color] ) false;
            else c.style.background = '#'+color;

            // Add some click listener to them.
            c.addEventListener("click",  function() {
                if ( isNotEmpty(GmapObj.displayOnly) && GmapObj.displayOnly[this.id] ) {
                    delete GmapObj.displayOnly[this.id] ;
                    if ( isEmpty(GmapObj.displayOnly) ) GmapObj.legend.className = 'googleControl';
                } else {
                    GmapObj.displayOnly[this.id] = true;
                    GmapObj.legend.className = 'googleControl googleControlActive';
                }

                GmapObj.plotItems();
            });

            c = r.insertCell(-1);
            c.innerHTML = total;

        }
        this.legend.appendChild(t);
    }


}
 

    GoogleMap.prototype.addToTable = function( info ) {

    log('addToTable():');
    if ( ! this.tableDiv ) return;

    //notify('addToTable():' + this.type);
    // Verify we have the div for this...
    if ( ! this.table ) this.getTable();

    // FOR EVENTS ONLY...
    if ( this.type == 'events' ) {

        var tb = this.table.tBodies[0];
        var r = tb.insertRow(0);
        r.id = info.id;
        r.innerHTML = '<td>'+info.lat+'</td>'+
                    '<td>'+info.lon+'</td>'+
                    '<td>'+info.depth+' km</td>'+
                    '<td>'+info.strtime+'</td>'+
                    '<td>'+info.magnitude+'</td>'+
                    '<td>'+info.srname+'</br>'+info.grname+'</td>'+
                    '<td>'+info.auth+'</td>'+
                    '<td>'+info.review+'</td>';
        if (GmapObj.map_config.tableInfoURL ) {
            var url = GmapObj.map_config.tableInfoURL + '/' + info.id ;
            r.addEventListener('click', function() { window.open(url); });
        } else {
            r.addEventListener('click', function() { 
                google.maps.event.trigger(GmapObj.datacache[this.id]['icon'], 'click');
                GmapObj.mapDiv.scrollIntoView(true);
            });
        }

        return;
    }
    log('addToTable(stations):' + this.table);

    // Verify data and cleanup of data
    if (! this.param in info ) return;
    var data = info[this.param];
    if ( ! Array.isArray(data) ) data = new Array(data);

    //this.getTable('station',this.tableDiv);
    //if (! this.tableDiv ) return;

    // Set the class for this icon.
    var buttonClass = ' station_button';
    if (info.status != 'online') buttonClass += ' station_button_offline ';

    for (var i=0; i < data.length; i++) {
        var each = data[i];
        try {
            var newcolor = this.style[each.toLowerCase()]['color'];
            var newname = this.style[each.toLowerCase()]['name'];
        } catch(err) {
            notify('CANNOT FIND STYLE FOR ' + this.param + ' ' + each);
            var newcolor = 'FFFFFF';
            var newname =  'UNKNOWN';
        }
        log('Adding '+info.sta+' on type: ' + each);

        var group  = document.getElementById(each);
        // May need new row on table
        if ( ! group ) {
            var r = this.table.insertRow(-1);
            var cell = r.insertCell(0);
            cell.innerHTML = newname + ' ( ' + each + ' )';
            cell.className = 'net_table_hdr' ;
            cell.style.background = '#'+newcolor;
            r = this.table.insertRow(-1);
            group = r.insertCell(0);
            group.className = 'net_table_row' ;
            group.id = each;
            group.style.background = '#'+newcolor;
        }

        var r = document.createElement('a');
        r.id = info.sta ;
        r.innerHTML = info.snet + "_" + info.sta ;
        r.className = buttonClass;

        if (GmapObj.map_config.tableInfoURL ) {
            var url = GmapObj.map_config.tableInfoURL + '/' + info.snet + '/' + info.sta;
            r.addEventListener('click', function() { window.open(url); });
        } else {
            r.addEventListener('click', function() { 
                google.maps.event.trigger(GmapObj.datacache[this.innerHTML]['icon'], 'click');
                GmapObj.mapDiv.scrollIntoView(true);
            });
        }

        group.appendChild(r) ;
    }

}

GoogleMap.prototype.getTable = function() {
    log('getTable: ' +  this.tableDiv );

    // Make table if missing
    if ( ! this.table ) {
        if (this.type == 'events') {
            var id = 'table_for_events';
            var head = '<th>Latitude</th><th>Longitude</th>'+
                    '<th>Depth</th><th>UTC Time</th>'+
                    '<th>Magnitude</th><th>Location</th>'+
                    '<th>Author</th><th>Reviewed</th>';
        } else {
            var id = 'table_for_stations';
            var head = false;
        }

        this.tableDiv.className += " eventTable";

        var c, h;
        this.table = document.createElement('table');
        this.table.id = id;
        if (head) {
            h = this.table.createTHead();
            h.innerHTML = head;
        }
        this.tableDiv.appendChild(this.table);
        this.table.createTBody();
    }
}

GoogleMap.prototype.newCircle = function(position,color,size,zindex,style) {

    var border = color;
    if ( this.map_config.markeredge )  var border = this.map_config.markeredge ;

    var diameter = size * 2;
    if ( this.map_config.markersize )  var diameter = this.map_config.markersize ;

    if ( style === 'full') {
        var fill = 0.8;
        var stroke = 1;
    } else {
        var fill = 0.1;
        var stroke = 2;
    }

    return new google.maps.Marker({
        position: position,
        draggable: false,
        raiseOnDrag: false,
        map: this.map,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: color,
            fillOpacity: fill,
            strokeColor: border,
            strokeOpacity: 1,
            strokeWeight: stroke,
            scale: diameter
        },
        zIndex: zindex
    });

}

GoogleMap.prototype.convertDepth = function(depth) {
    if (Number(depth) !== depth) return 0;

    var invert = ( this.anaglyph_invert ) ? -1 : 1;
    var xMax = 4;
    var xMin = 0;

    var yMax = 800;
    var yMin = 0;

    var percent = (depth - yMin) / (yMax - yMin);
    return invert * percent * (xMax - xMin) + xMin;
}


GoogleMap.prototype.newLabel = function(info) {

    if ( this.type == 'stations' ) {
        var label = new Label({ map:this.map });
        label.set('zIndex', 999);
        label.bindTo('position', info.icon, 'position');
        label.set('text', info.id);

        if ( ! this.map_config.displayNames ) {
            label.hide();
            google.maps.event.addListener(info.icon, 'mouseover', function() {
                label.show();
            });
            google.maps.event.addListener(info.icon, 'mouseout', function() {
                label.hide();
            });
        }

        // this.lablecache.push( label );
        return label; 
    } else return false;
}

GoogleMap.prototype.newIcon = function(info) {

    if (this.type == 'events') {
        // EVENT ICON

        var size = ( parseFloat(info.magnitude) ) ? parseFloat(info.magnitude):3;

        var style = 'full';

        //  ANAGLYPH
        if ( this.anaglyph ) { 
            // Left
            var color = 'red';
            var shift = info.lon + this.convertDepth(info.depth);
            var positionL= new google.maps.LatLng(info.lat, shift);
            var markerL = this.newCircle(positionL,color,size,info.zindex+1,style);

            // Right
            var color = 'cyan';
            var shift = info.lon - this.convertDepth(info.depth);
            var positionR= new google.maps.LatLng(info.lat, shift);

            var markerR = this.newCircle(positionR,color,size,info.zindex,style);

            return [markerL, markerR];

        } else {
            if ( ! info.review || info.review == '-' || info.review == 'auto'  ) var style = 'emtpy';
            var position= new google.maps.LatLng(info.lat, info.lon);
            var marker = this.newCircle(position,info.color[0],size,info.zindex, style);
        }

    } else {
        // STATION ICON

        var url = this.map_config.iconapi+'?'+'size='+this.map_config.stationIconSize
            + '&status=' + info.status;

        var color = '';
        var total = 0;
        for (var c=0; c < info.color.length; c++) {
            color = info.color[c];
            if ( color in this.colorHide && this.colorHide[color] ) continue;
            total += 1;
            var n = (total > 1) ? total : '';
            url += '&fillcolor'+n+'=%23' + color;
        }

        var marker = new google.maps.Marker({
            position: new google.maps.LatLng(info.lat, info.lon),
            draggable: false,
            map: this.map,
            zIndex: info.zindex,
            icon: {
                url: url,
                anchor: new google.maps.Point(this.map_config.markermiddle,this.map_config.markermiddle)
            }
        });

    //notify('( ' + info.lat + ', ' + info.lon + ' )');

    }

    google.maps.event.addListener(marker, "click", function()  {  

        var url = GmapObj.map_config.iconInfoURL + '?id=' + info.id;  
        log('Get infowindow: ' + url );
        $.ajax({
            url: url,
            dataType: "html",
            async: false,
            success: function(data) {  
                //log(data);
                GmapObj.iw.setContent(data);  
                GmapObj.iw.open(GmapObj.map, marker);  
            }  
        });
    }); 

    return marker;

}

GoogleMap.prototype.plotGeneric = function(lat,lon,size,color) {
    log('plotGeneric(): ' + lat + ' ' + lon);
 
    size = ( parseFloat(size) ) ? parseFloat(size):5;
    if ( ! color ) color = 'FF0000';
    var markermiddle = size/2;
    var shape = 'star';

    var url = this.map_config.iconapi+'?'+'size='+size+'&shape='+shape
        + '&fillcolor=%23' + color ;

    var marker = new google.maps.Marker({
        position: new google.maps.LatLng(lat, lon),
        draggable: false,
        map: this.map,
        zIndex: 10,
        icon: {
            url: url,
            anchor: new google.maps.Point(markermiddle,markermiddle)
        }
    });
 
    if (this.bounds) {
        this.bounds.extend( marker.position );
        this.map.fitBounds( this.bounds );
    }
}

GoogleMap.prototype.parseData = function(info) {

    // New object with all information needed for the
    // icons that we want to plot.

    log( 'Create new object' ) ;

    var icon = new Object() ;

    icon.lat = ('lat' in info) ? info.lat : false ; 
    icon.lon = ('lon' in info) ? info.lon : false ; 

    // Might have full location
    icon.lat = ('latlat' in info) ? info.latlat : icon.lat ; 
    icon.lon = ('lonlon' in info) ? info.lonlon : icon.lon ; 


    icon.id = ('id' in info) ? info.id : '-' ; 
    if ( this.type == 'events' ) {
        icon.active = true; 
        icon.time = ('time' in info) ? info.time : "-"; 
        icon.evid = ('evid' in info) ? info.evid : 0; 
        icon.orid = ('orid' in info) ? info.orid : 0; 
        icon.auth = ('auth' in info) ? info.auth : "-"; 
        icon.depth = ('depth' in info) ? info.depth : 0; 
        icon.grname = ('grname' in info) ? info.grname : ""; 
        icon.ndef = ('ndef' in info) ? info.ndef : 0; 
        icon.nass = ('nass' in info) ? info.nass : 0; 
        icon.local_timestring = ('local_timestring' in info) ? info.local_timestring : ""; 
        icon.magnitude = ('magnitude' in info) ? info.magnitude : "-"; 
        icon.review = ('review' in info) ? info.review : "false"; 
        //this.sacale = ('sacale' in info) ? info.sacale : ""; 
        icon.srname = ('srname' in info) ? info.srname : ""; 
        //this.utc_timestring = ('utc_timestring' in info) ? info.utc_timestring : ""; 
        icon.strtime = ('strtime' in info) ? info.strtime : ""; 
    } 
    else if ( this.type == 'stations' ) {
        icon.snet = ( 'snet' in info ) ? info['snet'] : false ;

        if ( this.map_config.snet.length > 0 ) {
            if ( this.map_config.snet.indexOf(info.snet) < 0) {
                icon.lat = null ; 
                icon.lon = null ; 
                return icon;
            }
        }

        icon.sta = ('sta' in info) ? info.sta : '-' ; 
        icon.vnet = ( 'vnet' in info ) ? info['vnet'] : false ;

        icon.endtime = ('endtime' in info) ? info.endtime : '-' ; 
        icon.active = ( icon.endtime == '-' ) ? true : false ;


        icon.sensor = this.getLastInstrument(info['sensor']);
        icon.digitizer = this.getLastInstrument(info['digitizer']);

        var r = this.getNewestComms(info['comm']);
        icon.commtype = r[0];
        icon.provider = r[1];

        // Orbstat
        icon.latest = 0;
        icon.latency = 0;
        icon.status = 'online';
        if ( icon.endtime == "-" && this.map_config.showStatus) {
            icon.status = 'offline';
            if ('orb' in info ) {
                for(var key in info.orb) {
                    if ( ! key.match(/^.+\/MST.*$/) ) {
                        if (info.orb[key] > icon.latest ) icon.latest = info.orb[key];
                    }
                }

                if ( icon.latest ) {
                    icon.latency = getlatency(icon.latest);
                    if ( icon.latency < 86400 )  icon.status = 'warning';
                    if ( icon.latency < 14400 )  icon.status = 'online';
                }
            }
        }
    }

    return icon;

}

GoogleMap.prototype.getNewestComms = function(info) {
    var type = 'unknown';
    var provider = 'unknown';
    var endtime = 0;
    var temp = 0;

    for (var t in info) {
        temp = info[t]['endtime'];
        if (temp == '-' || temp > endtime) {
            type = info[t]['commtype'];
            provider = info[t]['provider'];
            endtime = info[t]['endtime'];
        }
    }

    log('getNewestComm(): ' + type + '-' + provider);
    return [type, provider];
}

GoogleMap.prototype.getLastInstrument = function(info) {
    var name = {};

    for (var n in info) {
        for (var s in info[n]) {
            for (var a in info[n][s]) {
                if ( info[n][s][a]['endtime'] == '-' ) {
                    if ( n == '-') name[ 'unknown' ] = 1;
                    else name[ n ] = 1;
                }
            }
        }
    }

    name = Object.keys( name ) ;

    return ( ! name.length ) ? ['unknown']: name ;

}

GoogleMap.prototype.getColor = function( key) {

    if ( this.map_config.markercolor ) return this.map_config.markercolor ;
    //if ( this.map_config.markercolor ) return 'red' ;

    if ( this.type == 'events' ) {
        key = ageSecs(key);

        if (key < 21600) return 'red';
        else if (key < 43200) return 'orange';
        else if (key < 86400) return 'yellow';
        else if (key < 259200) return 'yellowgreen';
        else if (key < 604800) return 'steelblue';
        else return 'lightblue';
    }

    // Recursive call of this same funct.
    if ( typeof key !== 'string' ) {
        var colors = new Array();
        for (var i=0; i < key.length; i++) {
            color = this.getColor(key[i]);
            if (color) colors.insert(0,color);
        }
        return colors;
    }

    // If we only have 1 key...
    if (! key) key='unknown';
    var temp = { 'name':'unknown', 'hide':false, 'color': nullcolor };

    temp = (key.toLowerCase() in this.style) ? this.style[key.toLowerCase()] : temp;

    var color = temp['color'];
    //notify('getColor( ' + key + ' ) = ' + color);

    if ( typeof(this.styleBuffer[key]) === 'undefined') this.styleBuffer[key] = new Object();
    if ( typeof(this.styleBuffer[key][color]) === 'undefined') {
        this.styleBuffer[key][color] = 1;
    } else {
        this.styleBuffer[key][color] += 1;
    }

    // Track if we want to display this color on the icons.
    this.colorHide[color] = ( 'hide' in temp && temp['hide'] ) ? 1 : 0;

    //return ( 'hide' in temp && temp['hide'] ) ? null : color;
    return color;
}


GoogleMap.prototype.getZindex = function( key) {

    var defaultindex = 1;

    if ( this.type == 'events' ) {
        //var defaultstyle = { 'text':'> 7 days', 'zindex': 4 };
        //var values = (key in this.eventconfig) ? this.eventconfig[key] : defaultstyle;
        //if (element && element in values) { values = values[element]; }
        //return values;
        return (key in this.eventconfig) ? this.eventconfig[key]['zindex'] : defaultindex;
    }

    // Recursive call of this same funct.
    if ( typeof key !== 'string' ) {
        var zindex = new Array();
        for (var i=0; i < key.length; i++) {
            zindex.insert( 0, this.getZindex(key[i]) );
        }
        return zindex.max();
    }

    //if (! key) return defaultindex;

    var temp = (key.toLowerCase() in this.style) ? 
        this.style[key.toLowerCase()] : {'zindex':defaultindex};

    return ( 'zindex' in temp ) ? temp['zindex'] : defaultindex;
}
