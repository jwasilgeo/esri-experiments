require([
  'dojo/dom-construct',

  'esri/geometry/Point',
  'esri/Graphic',
  'esri/layers/GraphicsLayer',
  'esri/Map',
  'esri/views/SceneView',

  'dojo/domReady!'
], function(
  domConstruct,
  Point, Graphic, GraphicsLayer, Map, SceneView
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

  sceneViewB.on('click,double-click,drag,hold,key-down,key-up,mouse-wheel,pointer-down,pointer-move,pointer-up', function(evt) {
    evt.stopPropagation();
  });

  sceneViewA.when(function() {
    // start the views zoomed in, and then zoom out to show the globe
    setTimeout(function() {
      sceneViewA.goTo({
        zoom: 3
      });
    }, 7000);

    sceneViewA.watch('camera', function(sceneViewACamera) {
      // set the antipode camera in the secondary scene view
      var antipodeCamera = sceneViewACamera.clone();
      antipodeCamera.position.longitude += 180;
      antipodeCamera.position.latitude *= -1;
      sceneViewB.camera = antipodeCamera;
    });

    sceneViewA.on('pointer-move', function(evt) {
      var pointerGeometry = sceneViewA.toMap({
        x: evt.x,
        y: evt.y
      });

      if (pointerGeometry) {
        var pointerGraphic = new Graphic({
          geometry: pointerGeometry,
          symbol: {
            type: 'simple-marker',
            color: '#f44336',
            outline: {
              color: 'orange',
              width: 1.75
            },
            size: 17
          }
        });

        var antipodeGraphic1 = pointerGraphic.clone();
        antipodeGraphic1.geometry.longitude += 180;
        antipodeGraphic1.geometry.latitude *= -1;

        // another antipode (really in the same place) to avoid "missing" graphic wrap-around
        var antipodeGraphic2 = pointerGraphic.clone();
        antipodeGraphic2.geometry.longitude -= 180;
        antipodeGraphic2.geometry.latitude *= -1;

        graphicsLayer.removeAll();
        graphicsLayer.addMany([pointerGraphic, antipodeGraphic1, antipodeGraphic2]);

        // display both views' altitude values
        var altitudeAString = pointerGeometry.z >= 0 ? pointerGeometry.z.toFixed(0) : 0;
        altitudeANode.innerHTML = altitudeAString + 'm';
        altitudeANode.style.color = getAltitudeColor(altitudeAString);

        // do a map --> screen --> map conversion to forcibly update the antipode point geometry to have the correct "z" altitude value
        var antipodePointForAltitude = sceneViewB.toScreen(antipodeGraphic1.geometry);
        antipodePointForAltitude = sceneViewB.toMap({
          x: antipodePointForAltitude.x,
          y: antipodePointForAltitude.y
        });

        var altitudeBString = antipodePointForAltitude && antipodePointForAltitude.z >= 0 ? antipodePointForAltitude.z.toFixed(0) : 0;
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
