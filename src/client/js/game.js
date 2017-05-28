const io = require('socket.io-client');
const global = require('./global');


if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

var player = {
    id: -1,
    x: global.screenWidth / 2,
    y: global.screenHeight / 2,
    screenWidth: global.screenWidth,
    screenHeight: global.screenHeight,
    target: {x: global.screenWidth / 2, y: global.screenHeight / 2}
};


var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.onchange = settings.toggleRoundFood;


$("#feed").click(function () {
    socket.emit('1');
    window.control.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.control.reenviar = false;
});


const Control = require('./control');
window.control = new Control();

const Drawing = require('./Drawing');
new Drawing(window.control.cv.getContext('2d'));


const SocketClient = require('./socketclient');
var socketClient = new SocketClient();


class Game {
    constructor() {
        this.leaderboard = [];
        global.target = {x: player.x, y: player.y};
        global.player = player;
    }

    onLoad() {

        let self = this;

        var btn = document.getElementById('startButton'),
            playerNameInput = document.getElementById('playerNameInput'),
            nickErrorText = document.querySelector('#startMenu .input-error');


        btn.onclick = function () {

            // Checks if the nick is valid and not empty
            if (self.validNick() && playerNameInput.value !== "") {
                nickErrorText.style.opacity = 0;
                self.startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        };

        var settingsMenu = document.getElementById('settingsButton');
        var settings = document.getElementById('settings');
        var instructions = document.getElementById('instructions');

        settingsMenu.onclick = function () {
            if (settings.style.maxHeight === '300px') {
                settings.style.maxHeight = '0px';
            } else {
                settings.style.maxHeight = '300px';
            }
        };

        playerNameInput.addEventListener('keypress', function (e) {
            var key = e.which || e.keyCode;

            if (key === global.KEY_ENTER) {
                if (self.validNick()) {
                    nickErrorText.style.opacity = 0;
                    self.startGame('player');
                } else {
                    nickErrorText.style.opacity = 1;
                }
            }
        });
    }

    validNick() {
        var regex = /^\w*$/;
        global.debug('Regex Test', regex.exec(playerNameInput.value));
        return regex.exec(playerNameInput.value) !== null;
    }

    startGame() {
        global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);

        global.screenWidth = window.innerWidth;
        global.screenHeight = window.innerHeight;

        document.getElementById('startMenuWrapper').style.maxHeight = '0px';
        document.getElementById('gameAreaWrapper').style.opacity = 1;
        if (!global.socket) {
            global.socket = io();
            socketClient.setupSocket(global.socket);
        }
        if (!global.animLoopHandle)
            animloop();
        global.socket.emit('respawn');
        window.control.socket = global.socket;
    }

    gameLoop() {
        if (global.died) {
            Drawing.gameOver('You died!');
        }
        else if (!global.disconnected) {
            if (global.gameStart) {

                Drawing.clear();
                Drawing.drawGrid();
                global.nodes.forEach(Drawing.drawNode);
                Drawing.drawCursor();
                global.spiderWeb.forEach(Drawing.drawSpiderWeb);

                if (global.borderDraw) {
                    Drawing.drawBorder();
                }
                var orderMass = [];
                for (var i = 0; i < global.users.length; i++) {
                    for (var j = 0; j < global.users[i].cells.length; j++) {
                        orderMass.push({
                            nCell: i,
                            nDiv: j,
                            mass: global.users[i].cells[j].mass
                        });
                    }
                }
                orderMass.sort(function (obj1, obj2) {
                    return obj1.mass - obj2.mass;
                });

                Drawing.drawPlayers(orderMass);
                console.log(window.control.target);
                if (window.control.target !== undefined) {
                    global.socket.emit('0', window.control.target); // playerSendTarget "Heartbeat".
                }

            } else {
                Drawing.gameOver('Game Over');
            }
        } else {
            if (global.kicked) {
                Drawing.gameOver('You were kicked out!');
            } else {
                Drawing.gameOver('Disconnected!');

            }
        }
    }

}


let game = new Game();

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

window.cancelAnimFrame = (function (handle) {
    return window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
})();

function animloop() {
    global.animLoopHandle = window.requestAnimFrame(animloop);
    game.gameLoop();
}

window.addEventListener('resize', resize);

function resize() {
    if (!global.socket) return;

    player.screenWidth = global.control.cv.width = global.screenWidth = window.innerWidth;
    player.screenHeight = global.control.cv.height = global.screenHeight = window.innerHeight;

    global.socket.emit('windowResized', {screenWidth: global.screenWidth, screenHeight: global.screenHeight});
}


window.onload = function () {
    game.onLoad();
};


module.exports = Game;
