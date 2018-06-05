    var applySort = function() {

        // New way for tableparser to sort by default...
        $.tablesorter.addParser({ 
            id: 'numeric_parse', 
            is: function(s) { 
                return true; 
            }, 
            format: function (s, table, cell, cellIndex) {
                var value = $(cell).find("span").text() || s;
                return parseFloat(value) || -Infinity;
            }, 
            type: 'numeric' 
        }); 
        // New way for tableparser to sort by default...
        $.tablesorter.addParser({ 
            id: 'text', 
            is: function(s) { 
                return false; 
            }, 
            format: function (s) {
                return s;
            }, 
            type: 'text' 
        }); 

        $("table").tablesorter( {
            debug:false,
            headers:{0:{sorter:'text'}}
        } ); 


    }

    var applyUpdate = function() {
        //$('table').trigger('sorton');
        //console.log('applyUpdate');
    }


