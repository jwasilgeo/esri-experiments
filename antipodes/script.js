require([
  'dojo/dom-construct',

  'esri/geometry/Point',
  'esri/Graphic',
  'esri/layers/GraphicsLayer',
  'esri/Map',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/views/SceneView',

  'dojo/domReady!'
], function(
  domConstruct,
  Point, Graphic, GraphicsLayer, Map, SimpleMarkerSymbol, SceneView
) {
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent)) {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
    return;
  }

  var creditsNode = document.getElementById('creditsNode');
  var altitudeANode = document.getElementById('altitudeA');
  var altitudeBNode = document.getElementById('altitudeB');

  var graphicsLayer = new GraphicsLayer({
    elevationInfo: {
      mode: 'on-the-ground'
    }
  });

  var map = new Map({
    basemap: 'hybrid',
    layers: [graphicsLayer],
    ground: 'world-elevation'
  });

  // var longLat = [-4.484, 39.972];
  var longLat = [-5.936, 39.296];

  var sceneViewA = new SceneView({
    container: 'sceneViewDivA',
    map: map,
    center: longLat,
    zoom: 11
  });

  sceneViewA.ui.add('creditsNode', 'bottom-right');
  creditsNode.style.display = 'block';

  var sceneViewB = new SceneView({
    container: 'sceneViewDivB',
    map: map,
    center: [180 + longLat[0], -longLat[1]], // antipode start location
    zoom: 11,
    ui: {
      components: []
    }
  });

  sceneViewB.then(function() {
    domConstruct.place('crosshairs', document.querySelector('#sceneViewDivB .esri-ui'), 'first');
  });

  sceneViewA.then(function() {
    // start the views zoomed in, and then zoom out to show the globe
    setTimeout(function() {
      sceneViewA.goTo({
        zoom: 3
      });
      sceneViewB.goTo({
        zoom: 3
      });
    }, 7000);

    sceneViewA.on('pointer-move', function(evt) {
      var pointerGeometry = sceneViewA.toMap({
        x: evt.x,
        y: evt.y
      });

      if (pointerGeometry) {
        var pointerGraphic = new Graphic({
          geometry: pointerGeometry,
          symbol: new SimpleMarkerSymbol({
            color: [255, 0, 0]
          })
        });

        graphicsLayer.removeAll();
        graphicsLayer.add(pointerGraphic);

        // set the antipode camera in the secondary scene view
        var antipodeCamera = sceneViewA.camera.clone();
        antipodeCamera.position.longitude = 180 + pointerGeometry.longitude;
        antipodeCamera.position.latitude = -pointerGeometry.latitude;
        sceneViewB.goTo(antipodeCamera);

        // try to get z altitude in the secondary antipode scene view
        var screenPointB = sceneViewB.toScreen(sceneViewB.center);
        var crosshairsGeometry = sceneViewB.toMap({
          x: screenPointB.x,
          y: screenPointB.y
        });

        // display both views' altitude values
        var altitudeAString = pointerGeometry.z >= 0 ? pointerGeometry.z.toFixed(0) : 0;
        altitudeANode.innerHTML = altitudeAString + 'm';
        altitudeANode.style.color = getAltitudeColor(altitudeAString);

        var altitudeBString = crosshairsGeometry.z >= 0 ? crosshairsGeometry.z.toFixed(0) : 0;
        altitudeBNode.innerHTML = altitudeBString + 'm';
        altitudeBNode.style.color = getAltitudeColor(altitudeBString);
      } else {
        clearAltitudes();
      }
    });
  });

  function clearAltitudes() {
    altitudeANode.innerHTML = '---';
    altitudeANode.style.color = getAltitudeColor(0);
    altitudeBNode.innerHTML = '---';
    altitudeBNode.style.color = getAltitudeColor(0);
  }

  function getAltitudeColor(altitude) {
    altitude = Number(altitude);
    if (altitude < 1) {
      return '#1f78b4';
    } else if (altitude < 500) {
      return '#fecc5c';
    } else if (altitude < 2000) {
      return '#fd8d3c';
    } else {
      return '#e31a1c';
    }
  }

});
