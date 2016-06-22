var sceneViewA, sceneViewB;
require([
    'dojo/dom-construct',
    'dojo/query',

    'esri/geometry/Point',
    'esri/Graphic',
    'esri/layers/GraphicsLayer',
    'esri/Map',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/views/SceneView',

    'dojo/domReady!'
], function(
    domConstruct, dojoQuery,
    Point, Graphic, GraphicsLayer, Map, SimpleMarkerSymbol, SceneView
) {
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

    sceneViewA = new SceneView({
        container: 'sceneViewDivA',
        map: map,
        center: longLat,
        zoom: 11
    });

    sceneViewA.ui.add('creditsNode', 'bottom-right');
    creditsNode.style.display = 'block';

    sceneViewB = new SceneView({
        container: 'sceneViewDivB',
        map: map,
        center: [180 + longLat[0], -longLat[1]], // antipode start location
        zoom: 11,
        ui: {
            components: []
        }
    });

    sceneViewB.then(function(view) {
        domConstruct.place('crosshairs', dojoQuery('#sceneViewDivB .esri-ui')[0], 'first');
    });

    sceneViewA.then(function(view) {
        // a workaround to get the ground elevation tiles to report reasonable values when zoomed way out initially:
        // start the views zoomed in, and then zoom out to show the globe
        setTimeout(function() {
            sceneViewA.goTo({
                zoom: 3
            });
            sceneViewB.goTo({
                zoom: 3
            });
        }, 7000);

        // simulate a view 'mouse-move' listener
        sceneViewA.container.addEventListener('mousemove', function(mouseEvt) {
            sceneViewA.hitTest(mouseEvt.layerX, mouseEvt.layerY).then(function(response) {
                if (response.results.length && response.results[0].mapPoint) {
                    var mouseGeometry = response.results[0].mapPoint.clone();

                    var mouseGraphic = new Graphic({
                        geometry: mouseGeometry,
                        symbol: new SimpleMarkerSymbol({
                            color: [255, 0, 0]
                        })
                    });

                    graphicsLayer.removeAll();
                    graphicsLayer.add(mouseGraphic);

                    var antipodeCamera = sceneViewA.camera.clone();
                    antipodeCamera.position.longitude = 180 + mouseGeometry.longitude;
                    antipodeCamera.position.latitude = -mouseGeometry.latitude;

                    sceneViewB.goTo(antipodeCamera, {
                        animate: true
                    });

                    // perform another hitTest at the crosshairs to try to get z altitude
                    var screenPointB = sceneViewB.toScreen(sceneViewB.center);
                    sceneViewB.hitTest(screenPointB.x, screenPointB.y).then(function(response) {
                        if (response.results.length && response.results[0].mapPoint) {
                            var altitudeAString = mouseGeometry.z >= 0 ? mouseGeometry.z.toFixed(0) : 0;
                            var altitudeBString = response.results[0].mapPoint.z >= 0 ? response.results[0].mapPoint.z.toFixed(0) : 0;

                            altitudeANode.innerHTML = altitudeAString + 'm';
                            altitudeBNode.innerHTML = altitudeBString + 'm';

                            altitudeANode.style.color = getAltitudeColor(altitudeAString);
                            altitudeBNode.style.color = getAltitudeColor(altitudeBString);
                        } else {
                            clearAltitudes();
                        }
                    });
                } else {
                    clearAltitudes();
                }

            });
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
