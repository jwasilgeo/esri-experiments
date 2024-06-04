var mapViewTop;
require([
  'esri/layers/FeatureLayer',
  'esri/Map',
  'esri/views/MapView',
  'esri/Viewpoint',

  'dojo/domReady!'
], function(
  FeatureLayer, Map, MapView, Viewpoint
) {
  var antipodeInfo = document.getElementById('antipodeInfo');
  var colorblindToggle = document.getElementById('colorblindToggle');
  var colorblindToggleImage = document.getElementById('toggle-btn');
  var credits = document.getElementById('credits');

  // MapView and Map initial values
  var longLatTop = [-5.936, 39.296]; // top map view start location
  var longLatAntipode = [180 + longLatTop[0], -longLatTop[1]]; // antipode map view start location
  var scale = 100000000;
  var countriesUrl = 'https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0';
  var countriesOutFields = ['COUNTRY'];

  mapViewTop = new MapView({
    container: 'viewDivTop',
    map: new Map({
      layers: [new FeatureLayer({
        url: countriesUrl,
        outFields: countriesOutFields
      })]
    }),
    center: longLatTop,
    scale: scale,
    rotation: 0,
    ui: {
      components: ['zoom', 'compass', 'attribution']
    },
    constraints: {
      minScale: 240000000,
      maxScale: 5515102
    }
  });

  var mapViewAntipode = new MapView({
    container: 'viewDivAntipode',
    map: new Map({
      layers: [new FeatureLayer({
        url: countriesUrl,
        outFields: countriesOutFields
      })]
    }),
    center: longLatAntipode,
    scale: scale,
    rotation: 180,
    ui: {
      components: []
    },
    constraints: {
      minScale: 240000000
    }
  });

  // do a bunch of waiting on view and layer resources to be loaded/ready
  mapViewTop
    .when(function() {
      mapViewTop.ui.add('antipodeInfo', 'top-right');
      antipodeInfo.style.display = 'flex';

      mapViewTop.ui.add('colorblindToggle', 'top-left');
      colorblindToggle.style.display = 'flex';
      colorblindToggle.addEventListener('click', changeColorScheme);

      mapViewTop.ui.add('credits', 'bottom-right');
      credits.style.display = 'flex';

      // establish listener to set antipode map view position and rotation
      // as a reaction to changes in the top map view position
      mapViewTop.watch('viewpoint', moveAntipodeMapView);

      return mapViewTop.map.layers.getItemAt(0).load();
    })
    .then(function() {
      return mapViewAntipode.map.layers.getItemAt(0).load();
    })
    .then(function(antipodeCountryLayer) {
      return mapViewAntipode.whenLayerView(antipodeCountryLayer);
    })
    .then(function(antipodeCountryLayerView) {
      // set the intial "traditional" color scheme
      changeColorScheme();

      // wait a bit more just to be safe
      setTimeout(function() {
        establishCountryInteractionListener(mapViewTop, antipodeCountryLayerView);
      }, 5000);
    });

  function moveAntipodeMapView() {
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

  function establishCountryInteractionListener(mapViewTop, antipodeCountryLayerView) {
    mapViewTop.on('pointer-down,pointer-move', function(evt) {
      // find out the country for the top MapView
      mapViewTop.hitTest({
        x: evt.x,
        y: evt.y
      }).then(function(response) {
        var topCountry = 'OCEAN'; // default value if there is no country under the mouse
        if (response.results.length && response.results[0].graphic) {
          topCountry = response.results[0].graphic.attributes.COUNTRY?.toUpperCase();
        }
        antipodeInfo.children[0].innerText = topCountry;
      });

      // find out the country for the antipode MapView,
      // using client-side graphics in the FeatureLayerView
      var antipodePoint = mapViewTop.toMap({
        x: evt.x,
        y: evt.y
      });
      antipodePoint.longitude += 180;
      antipodePoint.latitude *= -1;
      antipodePoint.normalize();

      var antipodeCountry = 'OCEAN'; // default value if there is no country under the mouse
      antipodeCountryLayerView.featuresView.graphics.some(function(graphic) {
        // point-in-polygon check with client-side country geometries
        if (graphic.geometry.contains(antipodePoint)) {
          antipodeCountry = graphic.attributes.COUNTRY?.toUpperCase();
          return true;
        } else {
          return false;
        }
      });
      antipodeInfo.children[2].innerText = antipodeCountry;
    });
  }


  var nextColorScheme = 'traditional';

  function changeColorScheme() {
    var topCountryFillColor,
      topCountryOutlineColor,
      mixBlendMode,
      antipodeCountryFillColor,
      antipodeCountryOutlineColor,
      backgroundColor,
      topCountryTextColor,
      antipodeCountryTextColor;

    if (nextColorScheme === 'traditional') {
      topCountryFillColor = [113, 170, 113, 0.65];
      topCountryOutlineColor = [167, 226, 242, 0.5];
      mixBlendMode = 'normal'; // or 'luminosity'
      antipodeCountryFillColor = [255, 0, 0, 0.2];
      antipodeCountryOutlineColor = [200, 0, 0, 0.3];
      backgroundColor = '#a7e2f2';
      topCountryTextColor = '#93d893';
      antipodeCountryTextColor = 'rgb(177, 34, 34)';
      colorblindToggleImage.src = 'img/traditionalRnd.png';

      nextColorScheme = 'grayscale';
    } else if (nextColorScheme === 'grayscale') {
      topCountryFillColor = [79, 79, 79, 1];
      topCountryOutlineColor = [22, 22, 22, 1];
      mixBlendMode = 'lighten'; // or 'luminosity', 'exclusion'
      antipodeCountryFillColor = [48, 48, 48, 1];
      antipodeCountryOutlineColor = [249, 78, 78, 1];
      backgroundColor = '#161616';
      topCountryTextColor = '#4f4f4f';
      antipodeCountryTextColor = '#f94e4e';
      colorblindToggleImage.src = 'img/grayscaleRnd.png';

      nextColorScheme = 'bright';
    } else if (nextColorScheme === 'bright') {
      topCountryFillColor = [0, 153, 255, 1];
      topCountryOutlineColor = [244, 244, 244, 1];
      mixBlendMode = 'multiply';
      antipodeCountryFillColor = [204, 232, 37, 1];
      antipodeCountryOutlineColor = [0, 0, 153, 1];
      backgroundColor = '#f4f4f4';
      topCountryTextColor = '#0099ff';
      antipodeCountryTextColor = '#acbc13';
      colorblindToggleImage.src = 'img/brightRnd.png';

      nextColorScheme = 'traditional';
    }

    var topCountryLayer = mapViewTop.map.layers.getItemAt(0);
    topCountryLayer.renderer.symbol.color = topCountryFillColor;
    topCountryLayer.renderer.symbol.outline.color = topCountryOutlineColor;
    mapViewTop.container.style.mixBlendMode = mixBlendMode;

    var antipodeCountryLayer = mapViewAntipode.map.layers.getItemAt(0);
    antipodeCountryLayer.renderer.symbol.color = antipodeCountryFillColor;
    antipodeCountryLayer.renderer.symbol.outline.color = antipodeCountryOutlineColor;
    mapViewAntipode.container.style.backgroundColor = backgroundColor;

    antipodeInfo.children[0].style.color = topCountryTextColor;
    antipodeInfo.children[2].style.color = antipodeCountryTextColor;

    // force a refresh (this goTo shouldn't be noticed by the user)
    mapViewTop.goTo({
      target: new Viewpoint({
        rotation: 360 + mapViewTop.rotation,
      })
    }, {
      animate: false
    });
  }

});
