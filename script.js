Papa.parse("data.csv", {
  download: true, skipEmptyLines: true, dynamicTyping: true, header: true,
  complete: function(parsed){

    //Crossfilter dimension and group setup
    var data = crossfilter(parsed.data),
      im = data.dimension(function(d) { return d["im_2015"]; }),
      ims = im.group(function(d) { return Math.floor(d / 5) * 5; }),
      gdp = data.dimension(function(d) { return d["gdp_2015"]; }),
      gdps = gdp.group(function(d) { return Math.floor(d / 5000) * 5000; }),
      country = data.dimension(function(d) { return d["Country Code"]; }),
      countries = country.group(function(d) { return d; });

    //DOM objects for rendering
    var hist_im = document.getElementById("hist_im"),
      hist_gdp = document.getElementById("hist_gdp"),
      map = document.getElementById("map");

    // colors
    var in_all = "#66F",
        in_none = "#EEE",
        in_here = "#CCC",
        in_there = "#CCF";


    //helpers
    function unpack(rows, key) {
      return rows.map(function(row) { return row[key]; });
    }

    function getXY(arr) {
      return { x: unpack(arr, "key"), y: unpack(arr, "value") }
    };

    function makeBars(coords, range, onColor, offColor) {
      return {
        type: 'bar', x: coords.x, y: coords.y,
        marker: {color: coords.x.map(function(x) {
          return range[0] < x && x < range[1] ? onColor : offColor; })
        },
      };
    }

    function makeShapes(range) {
      return !isFinite(range[0]) ? null : [{
        type: 'rect', xref: 'x', yref: 'paper',
        x0: range[0], x1: range[1], y0: 0, y1: 1,
        fillcolor: '#d3d3d3', opacity: 0.2, line: { width: 0 }
      }]
    }

    //save selected ranges, initialized to 'everything'
    var im_range =[-Infinity, Infinity],
      gdp_range =[-Infinity, Infinity],
      country_range = [],
      all_im = getXY(ims.all()),
      all_gdp = getXY(gdps.all());

    //define charts
    function react() {
      Plotly.react(hist_im, [
        makeBars(all_im, im_range, in_there, in_none),
        makeBars(getXY(ims.all()), im_range, in_all, in_here)
      ],
      {
        title: "Infant Mortality",
        yaxis: {"title": "# Countries"}, xaxis: {"title": "Mortality per 1,000 births"},
        width: 450, height: 300, margin: {r:20,b:40,t:80,l:40}, selectdirection: "h",
        barmode: "overlay", hovermode: false, showlegend: false, dragmode: "select",
        shapes: makeShapes(im_range)
      });

      Plotly.react(hist_gdp, [
        makeBars(all_gdp, gdp_range, in_there, in_none),
        makeBars(getXY(gdps.all()), gdp_range, in_all, in_here)
      ],
      {
        title: "GDP per Capita",
        yaxis: {"title": "# Countries"}, xaxis: {"title": "current USD"},
        width: 450, height: 300, margin: {r:20,b:40,t:80,l:40}, selectdirection: "h",
        barmode: "overlay", hovermode: false, showlegend: false, dragmode: "select",
        shapes: makeShapes(gdp_range)
      });

      Plotly.react(map, [{
        type: 'choropleth', locationmode: 'ISO-3',
        locations: unpack(countries.all(), "key"),
        hovertemplate: "%{location}<extra></extra>",
        z: countries.all().map(function(d){
          if(d.value == 0) { // excluded here
            if(country_range.length == 0) return 0.25;
            return country_range.indexOf(d.key) != -1 ? 0.25 : 0;
          }
          else { // included here
            if(country_range.length == 0) return 1;
            return country_range.indexOf(d.key) != -1 ? 1 : 0.5
          }
        }),
        showscale: false, zmin: 0, zmax: 1,
        colorscale: [[0, in_none],  [0.25, in_there], [0.5, in_here], [1, in_all] ]
      }],
      {
        dragmode: "lasso", margin: {r:0,b:0,t:0,l:0}, height: 250,
        geo: { projection: { type: 'robinson' } }
      });
    }

    // react once to create the charts for event subscription
    react();

    //set up selection listeners
    function hist_im_select(e) {
      if(e && !e.range) return;
      im_range = e ? [e.range.x[0], e.range.x[1]] : [-Infinity, Infinity];
      im.filter(im_range);
      react();
    }

    hist_im.on('plotly_selected',    hist_im_select);
    hist_im.on('plotly_doubleclick', hist_im_select);
    hist_im.on('plotly_selecting',   hist_im_select);

    function hist_gdp_select(e) {
      if(e && !e.range) return;
      gdp_range = e ? [e.range.x[0], e.range.x[1]] : [-Infinity, Infinity];
      gdp.filter(gdp_range);
      react();
    }

    hist_gdp.on('plotly_selected',    hist_gdp_select);
    hist_gdp.on('plotly_doubleclick', hist_gdp_select);
    hist_gdp.on('plotly_selecting',   hist_gdp_select);

    function map_select(e) {
      if(e && !e.points) return;
      if(e && e.points.length != 0) {
        country_range = unpack(e.points, "location");
        country.filter(function(d) {return country_range.indexOf(d) != -1;})
      }
      else {
        country_range = []
        country.filterAll();
      }
      react();
    }

    map.on('plotly_selected',  map_select);
    map.on('plotly_selecting', map_select);

    window.resetFilters = function() {
      hist_gdp_select();
      hist_im_select();
      map_select();
    };
  }
});
