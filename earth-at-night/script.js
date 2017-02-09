require([
  'esri/config',
  'esri/layers/WebTileLayer',
  'esri/Map',
  'esri/views/SceneView'
], function(esriConfig, WebTileLayer, Map, SceneView) {

  esriConfig.request.corsEnabledServers.push(
    'gibs.earthdata.nasa.gov',
    'a.basemaps.cartocdn.com',
    'b.basemaps.cartocdn.com',
    'c.basemaps.cartocdn.com',
    'd.basemaps.cartocdn.com'
  );

  var view = new SceneView({
    container: 'viewDiv',
    map: new Map(),
    camera: {
      position: [31, 28, 2000000],
      heading: 180
    },
    environment: {
      atmosphere: {
        quality: 'high'
      }
    },
    constraints: {
      altitude: {
        min: 500000
      }
    }
  });

  var earthAtNightLayer = new WebTileLayer({
    urlTemplate: '//gibs.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/{level}/{row}/{col}.jpg',
    copyright: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (<a href="https://earthdata.nasa.gov">ESDIS</a>) with funding provided by NASA/HQ.'
  });

  var labelsLayer = new WebTileLayer({
    visible: false,
    urlTemplate: '//{subDomain}.basemaps.cartocdn.com/dark_only_labels/{level}/{col}/{row}.png',
    copyright: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
    subDomains: ['a', 'b', 'c', 'd']
  });

  view.map.add(earthAtNightLayer);
  view.map.add(labelsLayer);

  view.then(function(view) {
    setTimeout(function() {
      view.goTo({
          position: [31, 28, 15000000],
          heading: 0
        }, {
          speedFactor: 0.25
        })
        .then(function() {
          labelsLayer.visible = true;
        });
    }, 5000);
  });
});
