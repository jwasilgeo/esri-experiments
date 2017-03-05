require([
  'esri/layers/FeatureLayer',
  'esri/Map',
  'esri/views/MapView',
  'esri/Viewpoint',

  'dojo/domReady!'
], function(
  FeatureLayer, Map, MapView, Viewpoint
) {
  var credits = document.getElementById('credits');
  var antipodeInfo = document.getElementById('antipodeInfo');

  // var longLat = [-4.484, 39.972];
  var longLat = [-5.936, 39.296];

  var mapViewTop = new MapView({
    container: 'viewDivTop',
    map: new Map({
      basemap: 'dark-gray-vector',
      layers: [new FeatureLayer({
        url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0',
        outFields: ['FID', 'Country']
      })]
    }),
    center: longLat,
    scale: 30000000,
    rotation: 0,
    ui: {
      components: ['zoom', 'compass', 'attribution']
    },
    constraints: {
      minScale: 240000000
    }
  });

  var mapViewAntipode = new MapView({
    container: 'viewDivAntipode',
    map: new Map({
      layers: [new FeatureLayer({
        url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0',
        outFields: ['FID', 'Country']
      })]
    }),
    center: [180 + longLat[0], -longLat[1]], // antipode start location
    scale: 30000000,
    rotation: 180,
    ui: {
      components: []
    },
    constraints: {
      minScale: 240000000
    }
  });

  mapViewTop.then(function() {
    mapViewTop.ui.add('credits', 'bottom-right');
    credits.style.display = 'flex';

    mapViewTop.ui.add('antipodeInfo', 'top-right');
    antipodeInfo.style.display = 'flex';

    mapViewAntipode.then(function() {
      // override symbology
      var mapViewTopCountryLayer = mapViewTop.map.layers.items[0];
      mapViewTopCountryLayer.renderer.symbol.color = [0, 255, 255, 1];
      mapViewTopCountryLayer.renderer.symbol.outline.color = [0, 0, 255, 1];
      mapViewTop.map.basemap = null;

      var mapViewAntipodeCountryLayer = mapViewAntipode.map.layers.items[0];
      mapViewAntipodeCountryLayer.renderer.symbol.color = [255, 255, 0, 1];
      mapViewAntipodeCountryLayer.renderer.symbol.outline.color = [255, 0, 0, 1];

      moveToAntipode().then(function() {

        // mapViewTop.on('pointer-move', function(evt) {
        //   mapViewTop.hitTest({
        //     x: evt.x,
        //     y: evt.y
        //   }).then(function(response) {
        //     antipodeInfo.children[0].innerText = 'ANTIPODE';
        //     if (response.results.length && response.results[0].graphic) {
        //       antipodeInfo.children[2].innerText = response.results[0].graphic.attributes.Country.toUpperCase();
        //     } else {
        //       antipodeInfo.children[2].innerText = 'OCEAN';
        //     }
        //   });

          // mapViewAntipode.hitTest({
          //   x: evt.x,
          //   y: evt.y
          // }).then(function(response) {
          //   if (response.results.length && response.results[0].graphic) {
          //     console.log('antipode: ', response.results[0].graphic.attributes.Country)
          //   }
          // });
        // });
      });

      mapViewTop.watch('center,rotation', moveToAntipode);

      function moveToAntipode() {
        return mapViewAntipode.goTo({
          target: new Viewpoint({
            rotation: 180 - mapViewTop.rotation,
          }),
          center: [180 + mapViewTop.center.longitude, -mapViewTop.center.latitude],
          scale: mapViewTop.scale
        }, {
          animate: false
        });
      }
    });
  });
});
