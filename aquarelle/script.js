var mapImageLayer, mapView;
require([
  'esri/Map',
  'esri/views/MapView',
  'esri/layers/MapImageLayer',

  'dojo/domReady!'
], function(
  Map, MapView, MapImageLayer
) {
  var map = new Map({
    // basemap: 'satellite'
  });

  mapImageLayer = new MapImageLayer({
    url: '//server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/'
  });
  map.add(mapImageLayer);

  // var longLat = [-4.484, 39.972];
  // var longLat = [-5.936, 39.296];
  var longLat = [-4.96, 57.47 ];

  mapView = new MapView({
    container: 'mapViewDiv',
    map: map,
    center: longLat,
    // zoom: 6
    scale: 2087870.012
  });

  mapView.ui.add('creditsNode', 'bottom-right');
  var creditsNode = document.getElementById('creditsNode');
  creditsNode.style.display = 'block';

  mapView.ui.add('controlsNode', 'bottom-left');
  var controlsNode = document.getElementById('controlsNode');
  controlsNode.style.display = 'block';

  var aquarelle;

  mapView.whenLayerView(mapImageLayer).then(function(layerView) {
    // The layerview for the layer

    mapView.watch('stationary', function(value) {
      if (!value) {
        var previousCanvas = document.getElementById('previousCanvas');
        if (previousCanvas) {
          previousCanvas.remove();
        }
      }
    });

    layerView.watch('updating', function(value) {
      if (!value) {
        setTimeout(function() {
          var image = document.getElementsByTagName('img')[0];

          if (aquarelle && aquarelle.hasOwnProperty('removeEventListener')) {
            aquarelle.removeEventListener('created', renderAquarelle);
          }

          var aquarelle = new Aquarelle(image, 'img/mask.png', {
            autoplay: true,
            loop: true
          });

          aquarelle.addEventListener('created', renderAquarelle);

          // aquarelle.setOptions({
          //   toFrequency: 1
          // });
        }, 50);
      }
    });

  });

  function renderAquarelle(evt) {
    var previousCanvas = document.getElementById('previousCanvas');
    if (previousCanvas) {
      previousCanvas.remove();
    }

    var image = document.getElementsByTagName('img')[0];

    var canvas = this.getCanvas();
    // canvas.removeAttribute('style');
    canvas.style.transform = image.style.transform;
    canvas.style.zIndex = 9999;
    canvas.style.position = 'inherit';

    canvas.id = 'previousCanvas';

    image.parentNode.insertBefore(canvas, image.nextSibling);
    // image.parentNode.removeChild(image);
  }


  // mapImageLayer.then(function(mapView) {
  //   // mapView.then(function(mapView) {
  //   // mapView.map.basemap.baseLayers.items[0].getTileUrl();
  //
  //   setTimeout(function() {
  //     var htmlCollection = document.getElementsByTagName('img');
  //     var imagesArray = [].slice.call(htmlCollection);
  //
  //     var canvas = document.getElementById('myCanvas');
  //     canvas.width = mapView.width;
  //     canvas.height = mapView.height;
  //     canvas.style = 'position: absolute; left: 0px; top: 0px;';
  //     var ctx = canvas.getContext('2d');
  //
  //     return;
  //
  //     imagesArray.forEach(function(image) {
  //       image.setAttribute('crossOrigin', 'anonymous');
  //       image.setAttribute('crossorigin', 'anonymous');
  //       ctx.drawImage(image, 0, 0, 256, 256);
  //     });
  //
  //     var dataUrl = canvas.toDataURL();
  //
  //     debugger;
  //
  //     return;
  //     imagesArray.forEach(function(image, idx) {
  //       if (idx < 16) {
  //         var aquarelle = new Aquarelle(image, 'img/mask.png', {
  //           autoplay: true,
  //           loop: true
  //         });
  //
  //         aquarelle.addEventListener('created', function(evt) {
  //           var canvas = this.getCanvas();
  //           // canvas.removeAttribute('style');
  //           canvas.style.transform = image.style.transform;
  //           canvas.style.zIndex = 9999;
  //           canvas.style.position = 'inherit';
  //
  //           image.parentNode.insertBefore(canvas, image.nextSibling);
  //           // debugger;
  //           image.parentNode.removeChild(image);
  //         });
  //       }
  //     });
  //
  //   }, 2000);
  // });

});
