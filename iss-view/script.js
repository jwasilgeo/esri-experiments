require([
  'esri/Map',
  'esri/views/SceneView',
  'esri/widgets/BasemapToggle'
], function (Map, SceneView, BasemapToggle) {
  let previousCoordinates;
  let currentIssCoordinates;
  let currentIssHeading = 0;

  const creditsNode = document.getElementById('creditsNode');
  const infoMessageNode = document.getElementById('infoMessageNode');
  const fallbackBgNode = document.getElementById('fallbackBg');
  const issLocatorIconEl = document.getElementById('issLocatorIcon');
  const issLocatorArrowEl = document.getElementById('issLocatorArrow');

  const issLocationUrl = 'https://api.wheretheiss.at/v1/satellites/25544';

  const firstCameraViewChangeDuration = 3000;
  const updateDelay = 10000;
  const cameraViewChangeDuration = updateDelay;

  const DEG_TO_RAD = Math.PI / 180;
  const LOCATOR_ALTITUDE = 7000000; // meters
  const MAIN_ALTITUDE = 550000;     // meters
  const ARROW_OFFSET = 38;          // pixels from icon center

  const view = new SceneView({
    container: 'viewNode',
    map: new Map({ basemap: 'satellite' }),
    center: [0, 0],
    zoom: -5,
    environment: {
      lighting: {
        date: Date.now(),
        cameraTrackingEnabled: false
      },
      atmosphere: {
        quality: 'high'
      }
    },
    constraints: {
      altitude: {
        max: 10000000000
      }
    },
    ui: {
      components: ['attribution']
    },
    navigation: {
      browserTouchPanEnabled: false,
      mouseWheelZoomEnabled: false,
      gamepad: {
        enabled: false
      }
    }
  });

  view.ui.add('creditsNode', 'bottom-right');
  creditsNode.style.display = 'flex';

  view.ui.add('locatorMapNode', 'top-right');

  const locatorView = new SceneView({
    container: 'locatorMapNode',
    map: new Map({ basemap: 'satellite' }),
    camera: { position: { x: 0, y: 0, z: LOCATOR_ALTITUDE }, tilt: 0, heading: 0 },
    ui: { components: [] }
  });

  locatorView.watch('camera', updateLocatorIconPosition);

  function updateLocatorIconPosition() {
    if (!currentIssCoordinates || !locatorView.ready) return;
    const screenPoint = locatorView.toScreen({
      type: 'point',
      latitude: currentIssCoordinates.latitude,
      longitude: currentIssCoordinates.longitude,
      spatialReference: { wkid: 4326 }
    });
    if (screenPoint) {
      issLocatorIconEl.style.left = `${screenPoint.x}px`;
      issLocatorIconEl.style.top = `${screenPoint.y}px`;

      const headingRad = currentIssHeading * DEG_TO_RAD;
      issLocatorArrowEl.style.left = `${screenPoint.x + Math.sin(headingRad) * ARROW_OFFSET}px`;
      issLocatorArrowEl.style.top = `${screenPoint.y - Math.cos(headingRad) * ARROW_OFFSET}px`;
    }
  }

  view.when(function (view) {
    if (new URLSearchParams(location.search).has('qa-error')) {
      establishIssLocationError(new Error('QA error mode'));
      return;
    }

    infoMessageNode.innerHTML = '<div>We\'re looking around for the space station. Hold on!</div><img src="./favicon.ico" width="80" alt="International Space Station icon" style="animation: 2s rotate-station-icon infinite linear; filter: brightness(500%);">';
    infoMessageNode.style.display = 'flex';

    establishIssLocation();
    disableZooming(view);
  });

  function hideInfoMessage() {
    infoMessageNode.innerHTML = '';
    infoMessageNode.style.display = 'none';
  }

  function addCustomBasemap() {
    const basemapToggle = new BasemapToggle({
      view,
      nextBasemap: 'osm',
      visibleElements: { title: false }
    });
    view.ui.add(basemapToggle, 'bottom-left');
  }

  function establishIssLocation() {
    fetch(issLocationUrl).then(establishIssLocationSuccess, establishIssLocationError);
  }

  async function establishIssLocationSuccess(response) {
    // get two initial locations to be able to determine the heading
    if (!response.ok) return;
    const res = await response.json();
    if (!previousCoordinates) {
      previousCoordinates = { latitude: res.latitude, longitude: res.longitude };
      setTimeout(establishIssLocation, 1000);
    } else {
      updateCameraPosition({ latitude: res.latitude, longitude: res.longitude }, firstCameraViewChangeDuration)
        .then(afterInitialPosition, afterInitialPosition);
    }
  }

  function afterInitialPosition() {
    getCurrentIssLocation();
    hideInfoMessage();
    addCustomBasemap();
    document.getElementById('locatorMapNode').style.opacity = 1;
    issLocatorIconEl.style.display = 'block';
    issLocatorArrowEl.style.display = 'block';
  }

  function establishIssLocationError(err) {
    console.error(err);
    fallbackBgNode.style.display = 'block';
    infoMessageNode.innerHTML = 'We had trouble finding out where the space station is right now. Please try later.';
    infoMessageNode.style.display = 'flex';

    setTimeout(function () {
      fallbackBgNode.style.display = 'none';
      hideInfoMessage();
      previousCoordinates = { latitude: 0, longitude: 0 };
      updateCameraPosition(previousCoordinates, 1000);
    }, 6000);
  }

  function getCurrentIssLocation() {
    fetch(issLocationUrl).then(getCurrentIssLocationSuccess, getCurrentIssLocationError);
  }

  function getCurrentIssLocationSuccess(response) {
    if (!response.ok) {
      getCurrentIssLocationError(new Error(`HTTP ${response.status}`));
      return;
    }
    response.json().then(function (res) {
      hideInfoMessage();
      updateCameraPosition({ latitude: res.latitude, longitude: res.longitude }, cameraViewChangeDuration);
      setTimeout(getCurrentIssLocation, updateDelay);
    });
  }

  function getCurrentIssLocationError(err) {
    console.error(err);
    infoMessageNode.innerHTML =
      '<div>It seems that we\'ve misplaced the space station.</div>' +
      '<div>We\'ll try to look again in a minute or two.</div>' +
      '<div>Go click on something else.</div>';
    infoMessageNode.style.display = 'flex';
    setTimeout(() => { infoMessageNode.style.display = 'none'; }, 15000);
    setTimeout(getCurrentIssLocation, 60000);
  }

  function updateCameraPosition(nextCoordinates, duration) {
    const a = new LatLon(previousCoordinates.latitude, previousCoordinates.longitude);
    const b = new LatLon(nextCoordinates.latitude, nextCoordinates.longitude);
    const heading = a.bearingTo(b);

    previousCoordinates = nextCoordinates;
    currentIssCoordinates = nextCoordinates;
    currentIssHeading = heading;

    issLocatorIconEl.style.transform = `rotate(${heading}deg)`;
    issLocatorArrowEl.style.transform = `rotate(${heading}deg)`;

    locatorView.goTo({
      position: { longitude: nextCoordinates.longitude, latitude: nextCoordinates.latitude, z: LOCATOR_ALTITUDE },
      tilt: 0,
      heading: 0
    }, { duration, easing: 'linear' });

    return view.goTo({
      position: {
        latitude: nextCoordinates.latitude,
        longitude: nextCoordinates.longitude,
        z: MAIN_ALTITUDE
      },
      tilt: 60,
      heading
    }, {
      speedFactor: 1,
      duration,
      maxDuration: 60000,
      easing: 'linear'
    });
  }

  function disableZooming(view) {
    function stopEvtPropagation(event) {
      event.stopPropagation();
    }

    view.on('mouse-wheel', stopEvtPropagation);
    view.on('pointer-down', stopEvtPropagation);
    view.on('pointer-move', stopEvtPropagation);
    view.on('hold', stopEvtPropagation);
    view.on('double-click', stopEvtPropagation);
    view.on('double-click', ['Control'], stopEvtPropagation);
    view.on('drag', stopEvtPropagation);
    view.on('drag', ['Shift'], stopEvtPropagation);
    view.on('drag', ['Shift', 'Control'], stopEvtPropagation);
    view.on('key-down', stopEvtPropagation);
  }
});
