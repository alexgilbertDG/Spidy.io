module.exports = {
    // Keys and other mathematical constants
    KEY_ESC: 27,
    KEY_ENTER: 13,
    KEY_CHAT: 13,
    KEY_FIREFOOD: 119,
    KEY_SPLIT: 32,
    KEY_LEFT: 37,
    KEY_UP: 38,
    KEY_RIGHT: 39,
    KEY_DOWN: 40,
    KEY_LEFT_A: 65,
    KEY_UP_W: 87,
    KEY_RIGHT_D: 68,
    KEY_DOWN_S: 83,
    borderDraw: false,
    spin: -Math.PI,
    enemySpin: -Math.PI,
    mobile: false,
    foodSides: 10,
    nodeSides: 10,
    virusSides: 20,

    //Game
    users : [],
    nodes : [],
    spiderWeb : [],
    socket:null,

    // Canvas
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    gameWidth: 0,
    gameHeight: 0,
    xoffset: -0,
    yoffset: -0,
    gameStart: false,
    disconnected: false,
    died: false,
    kicked: false,
    continuity: false,
    startPingTime: 0,
    toggleMassState: 0,
    cursor: {x:0,y:0,r:10},
    backgroundColor: '#f2fbff',
    lineColor: '#000000',
    debug : function (args) {
    if (console && console.log) {
        console.log(args);
        }
    }
};
