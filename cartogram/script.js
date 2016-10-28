require([
  'esri/config',

  'esri/geometry/geometryEngine',
  'esri/geometry/geometryEngineAsync',
  'esri/Graphic',
  'esri/layers/FeatureLayer',
  'esri/layers/GraphicsLayer',
  'esri/layers/WebTileLayer',
  'esri/Map',

  'esri/views/MapView'
], function(
  esriConfig,
  geometryEngine, geometryEngineAsync, Graphic, FeatureLayer, GraphicsLayer, WebTileLayer, Map,
  MapView
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
  var cartogramGraphicsLayer = new GraphicsLayer();

  var statesFeatureLayer = new FeatureLayer({
    url: '//services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_States_Generalized/FeatureServer/0'
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
    center: [-100, 25],
    zoom: 3,
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

  view.whenLayerView(statesFeatureLayer).then(function(lyrView) {
    lyrView.watch('updating', function(val) {
      if (!val) {
        // get all the features available for drawing
        lyrView.queryFeatures().then(function(stateGraphics) {
          var averageStateSize = stateGraphics.reduce(function(previousValue, currentGraphic) {
            if (previousValue.geometry) {
              return geometryEngine.geodesicArea(previousValue.geometry, 'square-kilometers') +
              geometryEngine.geodesicArea(currentGraphic.geometry, 'square-kilometers');
            } else {
              return previousValue +
              geometryEngine.geodesicArea(currentGraphic.geometry, 'square-kilometers');
            }
          }) / stateGraphics.length;

          console.log(averageStateSize);

          lyrView.layer.visible = false;

          stateGraphics.forEach(function(stateGraphic) {
            geometryEngineAsync.geodesicBuffer(stateGraphic.geometry, -50, 'kilometers')
              .then(function(bufferGeometry) {
                cartogramGraphicsLayer.add(new Graphic({
                  geometry: bufferGeometry,
                  symbol: lyrView.layer.renderer.symbol
                }));
              });
          });

        });

      }
    });
  });

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
