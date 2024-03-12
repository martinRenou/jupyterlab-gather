import {
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';
import * as THREE from 'three';

//@ts-expect-error AR.js doesn't have type definitions
import * as THREEx from '@ar-js-org/ar.js/three.js/build/ar-threex.js';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { Widget } from '@lumino/widgets';

class APODWidget extends Widget {
  /**
   * Construct a new APOD widget.
   */
  constructor() {
    super();
    this.initialize();
    this.animate();
  }

  clock: THREE.Clock;
  scene: THREE.Scene;
  ambientLight: THREE.AmbientLight;
  camera: THREE.Camera;
  arToolkitSource: any;
  arToolkitContext: any;
  markerControls: any;
  markerRootArray: THREE.Group[];
  markerGroupArray: THREE.Group[];
  patternArray: string[];
  rotationArray: THREE.Vector3[];
  markerRoot: THREE.Group;
  markerGroup: THREE.Group;
  sceneGroup: THREE.Group;
  pointLight: THREE.PointLight;
  loader: THREE.TextureLoader;
  stageMesh: THREE.MeshBasicMaterial;
  stage: THREE.Mesh;
  edgeGroup: THREE.Group;
  edgeGeometry: THREE.CylinderGeometry;
  edgeCenters: THREE.Vector3[];
  edgeRotations: THREE.Vector3[];
  gltfLoader: GLTFLoader;
  gltfModel: any;
  okToLoadModel: boolean;
  animations: THREE.AnimationClip[] | undefined;
  mixer: any;
  renderer: THREE.WebGLRenderer;
  animationRequestId: number | undefined;
  mixerUpdateDelta: number;
  now: number;
  then: number;
  elapsed: number;
  readonly fpsInterval: number;
  // observer: IntersectionObserver;
  existingWebcam: any;
  newWebcam: any;
  webcam_loaded: any;
  resolve: any;
  webcamFromArjs: HTMLElement | null;

  initialize() {
    this.scene = new THREE.Scene();

    // promise to track if AR.js has loaded the webcam
    this.webcam_loaded = new Promise(resolve => {
      this.resolve = resolve;
    });

    window.addEventListener('arjs-video-loaded', e => {
      this.resolve();
    });

    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.5);
    this.scene.add(ambientLight);

    this.camera = new THREE.Camera();
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setClearColor(new THREE.Color('lightgrey'), 0);
    this.renderer.setSize(640, 480);
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.top = '0px';
    this.renderer.domElement.style.left = '0px';
    this.node.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    const deltaTime = 0;
    const totalTime = 0;

    ////////////////////////////////////////////////////////////
    // setup arToolkitSource
    ////////////////////////////////////////////////////////////

    this.arToolkitSource = new THREEx.ArToolkitSource({
      sourceType: 'webcam'
    });

    this.arToolkitSource.init();

    ////////////////////////////////////////////////////////////
    // setup arToolkitContext
    ////////////////////////////////////////////////////////////

    // create atToolkitContext
    this.arToolkitContext = new THREEx.ArToolkitContext({
      cameraParametersUrl:
        THREEx.ArToolkitContext.baseURL + '../data/data/camera_para.dat',
      detectionMode: 'mono'
    });

    // copy projection matrix to camera when initialization complete
    this.arToolkitContext.init(() => {
      this.camera.projectionMatrix.copy(
        this.arToolkitContext.getProjectionMatrix()
      );
    });

    ////////////////////////////////////////////////////////////
    // setup markerRoots
    ////////////////////////////////////////////////////////////

    this.markerRootArray = [];
    this.markerGroupArray = [];
    this.patternArray = [
      'letterA',
      'letterB',
      'letterC',
      'letterD',
      'letterF',
      'kanji'
    ];

    const rotationArray = [
      new THREE.Vector3(-Math.PI / 2, 0, 0),
      new THREE.Vector3(0, -Math.PI / 2, Math.PI / 2),
      new THREE.Vector3(Math.PI / 2, 0, Math.PI),
      new THREE.Vector3(-Math.PI / 2, Math.PI / 2, 0),
      new THREE.Vector3(Math.PI, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ];

    for (let i = 0; i < 6; i++) {
      const markerRoot = new THREE.Group();
      this.markerRootArray.push(markerRoot);
      this.scene.add(markerRoot);
      const markerControls = new THREEx.ArMarkerControls(
        this.arToolkitContext,
        markerRoot,
        {
          type: 'pattern',
          patternUrl:
            THREEx.ArToolkitContext.baseURL +
            'examples/marker-training/examples/pattern-files/pattern-' +
            this.patternArray[i] +
            '.patt'
        }
      );

      let markerGroup = new THREE.Group();
      this.markerGroupArray.push(markerGroup);
      markerGroup.position.y = -1.25 / 2;
      markerGroup.rotation.setFromVector3(rotationArray[i]);

      markerRoot.add(markerGroup);
    }

    ////////////////////////////////////////////////////////////
    // setup scene
    ////////////////////////////////////////////////////////////

    this.sceneGroup = new THREE.Group();
    // a 1x1x1 cube model with scale factor 1.25 fills up the physical cube
    this.sceneGroup.scale.set(1.25 / 2, 1.25 / 2, 1.25 / 2);

    let loader = new THREE.TextureLoader();

    /*
	// a simple cube
	let materialArray = [
		new THREE.MeshBasicMaterial( { map: loader.load("images/xpos.png") } ),
		new THREE.MeshBasicMaterial( { map: loader.load("images/xneg.png") } ),
		new THREE.MeshBasicMaterial( { map: loader.load("images/ypos.png") } ),
		new THREE.MeshBasicMaterial( { map: loader.load("images/yneg.png") } ),
		new THREE.MeshBasicMaterial( { map: loader.load("images/zpos.png") } ),
		new THREE.MeshBasicMaterial( { map: loader.load("images/zneg.png") } ),
	];
	let mesh = new THREE.Mesh( new THREE.CubeGeometry(1,1,1), materialArray );
	sceneGroup.add( mesh );
	*/

    // let tileTexture = loader.load('images/tiles.jpg');

    // reversed cube
    this.sceneGroup.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshBasicMaterial({
          // map: tileTexture,
          color: '#1a1b26',
          side: THREE.BackSide
        })
      )
    );

    // cube vertices

    let sphereGeometry = new THREE.SphereGeometry(0.2, 6, 6);

    let sphereCenters = [
      new THREE.Vector3(-1, -1, -1),
      new THREE.Vector3(-1, -1, 1),
      new THREE.Vector3(-1, 1, -1),
      new THREE.Vector3(-1, 1, 1),
      new THREE.Vector3(1, -1, -1),
      new THREE.Vector3(1, -1, 1),
      new THREE.Vector3(1, 1, -1),
      new THREE.Vector3(1, 1, 1)
    ];

    let sphereColors = [
      0x444444, 0x0000ff, 0x00ff00, 0x00ffff, 0xff0000, 0xff00ff, 0xffff00,
      0xffffff
    ];

    for (let i = 0; i < 8; i++) {
      let sphereMesh = new THREE.Mesh(
        sphereGeometry,
        new THREE.MeshLambertMaterial({
          // map: tileTexture,

          color: sphereColors[i]
        })
      );
      sphereMesh.position.copy(sphereCenters[i]);
      this.sceneGroup.add(sphereMesh);
    }

    // cube edges

    let edgeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 32);

    let edgeCenters = [
      new THREE.Vector3(0, -1, -1),
      new THREE.Vector3(0, 1, -1),
      new THREE.Vector3(0, -1, 1),
      new THREE.Vector3(0, 1, 1),
      new THREE.Vector3(-1, 0, -1),
      new THREE.Vector3(1, 0, -1),
      new THREE.Vector3(-1, 0, 1),
      new THREE.Vector3(1, 0, 1),
      new THREE.Vector3(-1, -1, 0),
      new THREE.Vector3(1, -1, 0),
      new THREE.Vector3(-1, 1, 0),
      new THREE.Vector3(1, 1, 0)
    ];

    let edgeRotations = [
      new THREE.Vector3(0, 0, Math.PI / 2),
      new THREE.Vector3(0, 0, Math.PI / 2),
      new THREE.Vector3(0, 0, Math.PI / 2),
      new THREE.Vector3(0, 0, Math.PI / 2),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.PI / 2, 0, 0),
      new THREE.Vector3(Math.PI / 2, 0, 0),
      new THREE.Vector3(Math.PI / 2, 0, 0),
      new THREE.Vector3(Math.PI / 2, 0, 0)
    ];

    let edgeColors = [
      0x880000, 0x880000, 0x880000, 0x880000, 0x008800, 0x008800, 0x008800,
      0x008800, 0x000088, 0x000088, 0x000088, 0x000088
    ];

    for (let i = 0; i < 12; i++) {
      let edge = new THREE.Mesh(
        edgeGeometry,
        new THREE.MeshLambertMaterial({
          // map: tileTexture,
          color: edgeColors[i]
        })
      );
      edge.position.copy(edgeCenters[i]);
      edge.rotation.setFromVector3(edgeRotations[i]);

      this.sceneGroup.add(edge);
    }

    this.sceneGroup.add(
      new THREE.Mesh(
        new THREE.TorusKnotGeometry(0.5, 0.1),
        new THREE.MeshNormalMaterial()
      )
    );

    let pointLight = new THREE.PointLight(0xffffff, 1, 50);
    pointLight.position.set(0.5, 3, 2);
    this.scene.add(pointLight);
    this.setUpVideo();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  animate() {}

  update() {}

  async setUpVideo() {
    await this.webcam_loaded;
    // Create new webcam element
    this.existingWebcam = document.getElementById('arjs-video');
    this.newWebcam = this.existingWebcam.cloneNode(true);
    this.newWebcam.srcObject = this.existingWebcam.srcObject;
    this.newWebcam.id = 'webcamViewNew';
    this.newWebcam.style.display = '';
    this.newWebcam.style.zIndex = '0';
    // this.newWebcam.classList.add("jl-vid");
    this.node.appendChild(this.newWebcam);
  }
}
window.addEventListener('markerFound', () => {
  console.log('Marker found');
});

window.addEventListener('markerLost', () => {
  console.log('Marker lost');
});

/**
 * Activate the APOD widget extension.
 */
function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  settingRegistry: ISettingRegistry | null,
  restorer: ILayoutRestorer | null
) {
  console.log('JupyterLab extension jupyterlab_apod is activated!');

  // if (settingRegistry) {
  //   settingRegistry
  //     .load(plugin.id)
  //     .then(settings => {
  //       console.log(
  //         'jupyterlab_arpresent settings loaded:',
  //         settings.composite
  //       );
  //     })
  //     .catch(reason => {
  //       console.error(
  //         'Failed to load settings for jupyterlab_arpresent.',
  //         reason
  //       );
  //     });
  // }

  // requestAPI<any>('get-example')
  //   .then(data => {
  //     console.log(data);
  //   })
  //   .catch(reason => {
  //     console.error(
  //       `The jupyterlab_arpresent server extension appears to be missing.\n${reason}`
  //     );
  //   });
  let widget: MainAreaWidget<APODWidget>;

  // Add an application command
  const command: string = 'apod:open';
  app.commands.addCommand(command, {
    label: 'Random Astronomy Picture',
    execute: () => {
      // Regenerate the widget if disposed
      if (!widget || widget.isDisposed) {
        const content = new APODWidget();
        widget = new MainAreaWidget({ content });
        widget.id = 'apod-jupyterlab';
        widget.title.label = 'Astronomy Picture';
        widget.title.closable = true;
      }
      // if (!tracker.has(widget)) {
      //   // Track the state of the widget for later restoration
      //   tracker.add(widget);
      // }
      if (!widget.isAttached) {
        // Attach the widget to the main work area if it's not there
        app.shell.add(widget, 'main');
      }
      // Refresh the picture in the widget
      // widget.content.updateAPODImage();
      // Activate the widget
      app.shell.activateById(widget.id);
    }
  });

  // Add the command to the palette.
  palette.addItem({ command, category: 'Tutorial' });

  // Track and restore the widget state
  // const tracker = new WidgetTracker<MainAreaWidget<APODWidget>>({
  //   namespace: 'apod'
  // });
  // if (restorer) {
  //   restorer.restore(tracker, {
  //     command,
  //     name: () => 'apod'
  //   });
  // }
}

/**
 * Initialization data for the jupyterlab_arpresent extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_arpresent',
  description: 'Video presentation over WebRTC with AR capabilities.',
  autoStart: true,
  requires: [ICommandPalette],
  optional: [ILayoutRestorer, ISettingRegistry],
  activate: activate
};

export default plugin;
