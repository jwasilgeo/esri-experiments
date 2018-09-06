// https://developers.arcgis.com/javascript/latest/sample-code/visualization-point-styles/index.html

require([
  'esri/config',
  'esri/core/promiseUtils',

  'esri/layers/BaseElevationLayer',
  'esri/layers/BaseTileLayer',
  'esri/layers/FeatureLayer',
  'esri/layers/WebTileLayer',

  'esri/Map',
  'esri/views/SceneView',

  'esri/widgets/Locate',
], function(
  esriConfig, promiseUtils,
  BaseElevationLayer, BaseTileLayer, FeatureLayer, WebTileLayer,
  Map, SceneView,
  Locate
) {
  esriConfig.request.corsEnabledServers.push('gibs.earthdata.nasa.gov');

  var citiesLayer = new FeatureLayer({
    url: 'https://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/World_Cities/FeatureServer/0',
    elevationInfo: {
      mode: 'relative-to-ground'
    },
    returnZ: false,
    minScale: 25000000,
    definitionExpression: 'POP_RANK <= 4 OR STATUS LIKE \'%National%\'',
    outFields: ['CITY_NAME'],
    screenSizePerspectiveEnabled: true,
    featureReduction: {
      type: 'selection'
    },
    renderer: {
      type: 'simple',
      symbol: {
        // hide any kind of symbol showing up on the ground for the feature
        // because we're only intersted in the lable with a callout
        type: 'point-3d',
        symbolLayers: [{
          type: 'icon',
          size: 0
        }]
      }
    },
    labelingInfo: [{
      labelPlacement: 'above-center',
      labelExpressionInfo: {
        expression: '$feature.CITY_NAME'
      },
      symbol: {
        type: 'label-3d',
        symbolLayers: [{
          type: 'text',
          material: {
            color: 'black'
          },
          halo: {
            color: [255, 255, 255, 0.75],
            size: 1.75
          },
          size: 10
        }],
        verticalOffset: {
          screenLength: 10000,
          maxWorldLength: 50000,
          minWorldLength: 1000
        },
        callout: {
          type: 'line',
          size: 2,
          color: [255, 255, 255, 0.75]
        }
      }
    }]
  });

  // black base layer for SceneView and MapView adapted from @ycabon's
  // https://codepen.io/ycabon/pen/gvXqqj?editors=1000
  var BlackLayer = BaseTileLayer.createSubclass({
    constructor: function() {
      var canvas = this.canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      var ctx = canvas.getContext('2d');
      ctx.fillRect(0, 0, 256, 256);
    },
    fetchTile: function() {
      return promiseUtils.resolve(this.canvas);
    }
  });

  function createEarthAtNightLayer() {
    return new WebTileLayer({
      urlTemplate: 'https://gibs.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default//GoogleMapsCompatible_Level8/{level}/{row}/{col}.jpg',
      copyright: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (<a href="https://earthdata.nasa.gov">ESDIS</a>) with funding provided by NASA/HQ.'
    });
  }

  var EarthAtNight3DLayer = BaseElevationLayer.createSubclass({
    properties: {
      factor: 75000
    },
    load: function() {
      this._earthAtNightLayer = createEarthAtNightLayer();
      this.addResolvingPromise(this._earthAtNightLayer.load());
    },
    fetchTile: function(level, row, col) {
      if (level === 0) {
        return promiseUtils.resolve({
          values: [],
          width: 256,
          height: 256,
          noDataValue: -1
        });
      }

      if (level >= 9) {
        return promiseUtils.resolve({
          values: [],
          width: 256,
          height: 256,
          noDataValue: -1
        });
      }

      return this._earthAtNightLayer.fetchTile(level, row, col, {
        allowImageDataAccess: true
      })
        .then(function(imageElement) {
          var width = imageElement.width;
          var height = imageElement.height;

          var canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(imageElement, 0, 0, width, height);

          var imageData = ctx.getImageData(0, 0, width, height).data;

          var elevations = [];

          for (var index = 0; index < imageData.length; index += 4) {
            var r = imageData[index];
            var g = imageData[index + 1];
            var b = imageData[index + 2];

            var elevation = new chroma([r, g, b])
              // .desaturate(100)
              .luminance();

            elevation *= this.factor;

            elevations.push(elevation);
          }

          return {
            values: elevations,
            width: width,
            height: height,
            noDataValue: -1
          };
        }.bind(this));
    }
  });

  var view = new SceneView({
    container: 'viewDiv',
    map: new Map({
      basemap: {
        baseLayers: [
          new BlackLayer(),
        ]
      },
      ground: {
        layers: [
          new EarthAtNight3DLayer()
        ]
      },
      layers: [
        createEarthAtNightLayer(),
        citiesLayer
      ]
    }),
    camera: {
      position: {
        longitude: 24,
        latitude: 24,
        z: 650000
      },
      heading: 40,
      tilt: 55
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

  view.when(function(view) {
    var credits = document.getElementById('credits');
    view.ui.add(credits, 'bottom-right');
    credits.style.display = 'flex';

    view.ui.add(new Locate({
      view: view,
      graphic: null,
      goToOverride: function(view, goToParams) {
        var originalHeading = view.camera.clone().heading;

        return view.goTo({
          scale: 80000000,
          tilt: 0,
          heading: 0
        }, {
          speedFactor: 0.25
        })
          .then(function() {
            goToParams.target.tilt = 55;
            goToParams.target.scale = 650000;
            goToParams.target.heading = originalHeading;
            return view.goTo(goToParams.target, {
              speedFactor: 0.5
            });
          });
      }
    }), 'top-left');
  });
});
