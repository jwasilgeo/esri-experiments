require([
  'esri/config',

  'esri/geometry/geometryEngine',
  'esri/geometry/geometryEngineAsync',
  'esri/Graphic',
  'esri/layers/FeatureLayer',
  'esri/layers/GraphicsLayer',
  'esri/layers/WebTileLayer',
  'esri/Map',

  'esri/views/MapView',

  'dojo/Deferred',
], function(
  esriConfig,
  geometryEngine, geometryEngineAsync, Graphic, FeatureLayer, GraphicsLayer, WebTileLayer, Map,
  MapView,
  Deferred
) {
  esriConfig.request.corsEnabledServers.push(
    'stamen-tiles-a.a.ssl.fastly.net',
    'stamen-tiles-b.a.ssl.fastly.net',
    'stamen-tiles-c.a.ssl.fastly.net',
    'stamen-tiles-d.a.ssl.fastly.net'
  );

  var creditsNode = document.getElementById('credits'),
    instructionsNode = document.getElementById('instructions');

  // cartogram graphics will be added to this graphics layer
  var cartogramGraphicsLayer = new GraphicsLayer({
    popupTemplate: {
      title: '{STATE_NAME}',
      content: '{*}'
    }
  });

  var statesFeatureLayer = new FeatureLayer({
    url: '//services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_States_Generalized/FeatureServer/0',
    outFields: ['*']
  });

  // the view is either a MapView or a SceneView
  var view = new MapView({
    container: 'viewDiv',
    map: new Map({
      layers: [
        // use Stamen Toner for the basemap tiles
        new WebTileLayer({
          urlTemplate: '//stamen-tiles-{subDomain}.a.ssl.fastly.net/toner/{level}/{col}/{row}.png',
          subDomains: ['a', 'b', 'c', 'd'],
          copyright: [
            'Map tiles by <a href="http://stamen.com">Stamen Design</a>, ',
            'under <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. ',
            'Data by <a href="http://openstreetmap.org">OpenStreetMap</a>, ',
            'under <a href="http://www.openstreetmap.org/copyright">ODbL</a>.'
          ].join()
        }),
        statesFeatureLayer,
        cartogramGraphicsLayer
      ]
    }),
    center: [-100, 35],
    zoom: 5,
    ui: {
      components: ['attribution', 'zoom']
    }
  });


  view.then(function(view) {
    // position and show the credits element and rotate control element
    view.ui.add(creditsNode, 'bottom-right');
    creditsNode.style.display = 'block';

    view.ui.add(instructionsNode);
    instructionsNode.style.display = 'block';

    // establish conditional DOM properties based on the view width
    viewWidthChange(view.widthBreakpoint);
    view.watch('widthBreakpoint', function(newValue) {
      viewWidthChange(newValue);
    });
  });

  var averageStateSize;

  view.whenLayerView(statesFeatureLayer).then(function(lyrView) {
    lyrView.watch('updating', function(val) {
      if (!val) {
        // get all the features available for drawing
        lyrView.queryFeatures().then(function(stateGraphics) {

          averageStateSize = stateGraphics
            .map(function(graphic) {
              return geometryEngine.geodesicArea(graphic.geometry, 'square-kilometers');
            })
            .reduce(function(previousValue, currentValue) {
              return previousValue + currentValue;
            }) / stateGraphics.length;

          console.log(averageStateSize);

          lyrView.layer.visible = false;

          stateGraphics.forEach(function(stateGraphic, idx) {
            geometryEngineAsync.generalize(stateGraphic.geometry, 30, true, 'kilometers').then(function(geom) {
              doTheThing(stateGraphic.attributes.STATE_NAME, geom, 1).then(function(res) {
                console.log('what?', res);
                var symbol = lyrView.layer.renderer.symbol;
                symbol.color = [0,0,0,0.3];
                symbol.outline.width = 2;
                cartogramGraphicsLayer.add(new Graphic({
                  geometry: res,
                  symbol: lyrView.layer.renderer.symbol,
                  attributes: stateGraphic.attributes
                }));
              });
            });

            return;

            // geometryEngineAsync.generalize(stateGraphic.geometry.extent.expand(0.75)).then(function(geom) {
            // geometryEngineAsync.convexHull(stateGraphic.geometry).then(function(geom) {
            geometryEngineAsync.buffer(stateGraphic.geometry, -50, 'kilometers').then(function(geom) {

              // doTheThing(geom, 1, lyrView.layer.renderer.symbol).then(function(res) {
              // console.info(geom);
              cartogramGraphicsLayer.add(new Graphic({
                geometry: geom,
                symbol: lyrView.layer.renderer.symbol
              }));
              // });
            });


          });

        });

      }
    });
  });

  function doTheThing(name, geometry, posOrNeg, symbol) {
    // var dfd = new Deferred();

    return geometryEngineAsync.buffer(geometry, 50 * posOrNeg, 'kilometers', true).then(function(bufferGeometry) {

      // var bufferGeometry = geometryEngine.buffer(geometry, 50 * posOrNeg, 'kilometers', true);
      var geometrySize = geometryEngine.geodesicArea(bufferGeometry, 'square-kilometers');
      if (geometrySize > (averageStateSize - 50000) && geometrySize < (averageStateSize + 50000)) {
        console.log(`${name}: good enough`);
        return bufferGeometry;
        // dfd.resolve(bufferGeometry);
      } else if (geometrySize < (averageStateSize - 50000)) {
        console.log(`${name}: too small`);
        return doTheThing(name, bufferGeometry, 1, symbol);
      } else if (geometrySize > (averageStateSize + 50000)) {
        console.log(`${name}: too big`);
        return doTheThing(name, bufferGeometry, -1, symbol);
      }

    });

    // return dfd.promise;
  }

  function viewWidthChange(widthBreakpoint) {
    if (widthBreakpoint === 'xsmall') {
      if (instructionsNode.style.display !== 'none') {
        view.ui.move(instructionsNode, 'manual');
      }
      view.ui.move('zoom', 'bottom-left');
    } else {
      if (instructionsNode.style.display !== 'none') {
        view.ui.move(instructionsNode, 'top-right');
      }
      view.ui.move('zoom', 'top-left');
    }
  }
});
