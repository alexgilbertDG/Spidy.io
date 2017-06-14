
const global = require('./global');


class SocketClient {

    constructor(player) {
        this.player = player;
    }

    setupSocket(socket) {
        // Handle ping.
        socket.on('pongcheck', function () {
            var latency = Date.now() - global.startPingTime;
            global.debug('Latency: ' + latency + 'ms');
        });

        // Handle error.
        socket.on('connect_failed', function () {
            socket.close();
            global.disconnected = true;
        });

        socket.on('disconnect', function () {
            socket.close();
            global.disconnected = true;
        });

        // Handle connection.
        socket.on('welcome', function (playerSettings) {
            this.player = playerSettings;
            this.player.name = global.playerName;
            this.player.screenWidth = global.screenWidth;
            this.player.screenHeight = global.screenHeight;
            this.player.target = global.target;
            global.player = this.player;
            socket.emit('gotit', this.player);
            global.gameStart = true;
            global.debug('Game started at: ' + global.gameStart);
            window.control.cv.focus();
        });

        socket.on('gameSetup', function (data) {
            global.gameWidth = data.gameWidth;
            global.gameHeight = data.gameHeight;
            resize();
        });

        socket.on('playerDied', function (data) {
            //A OTHER this.player DIED
        });

        socket.on('playerDisconnect', function (data) {
            //A OTHER this.player DISCONNECT
        });

        socket.on('playerJoin', function (data) {
            //A OTHER this.player JOIN
        });

        socket.on('leaderboard', function (data) {
            let leaderboard = data.leaderboard;


            var status = '<span class="title">Leaderboard</span>';
            for (var i = 0; i < leaderboard.length; i++) {
                 let oPlayer = leaderboard[i];
                let me = '';
                if (oPlayer.id === this.player.id) me = 'me';
                status += '<br />';
                let size = Math.min(Math.max(parseInt(oPlayer.controlNodes), 5), 25);
                status += ('<img src="img/spider_' + oPlayer.hue + '.png" width="' + size + 'px"/>');
                status += ' <span style="color:hsl(' + oPlayer.hue + ', 50%, 50%);" class="' + me + '">';
                status += oPlayer.name.toUpperCase();
                status += ' </span>';
            }
            document.getElementById('status').innerHTML = status;
        });

        socket.on('serverMSG', function (data) {

        });

        // Chat.
        socket.on('serverSendPlayerChat', function (data) {

        });

        socket.on('receiveShootingNodeStarting', function (pos) {
             this.player.startingWeb = pos;
         });

        socket.on('receiveShootingNode', function (pos) {
         this.player.webAttach = pos;
        });


        // Handle movement.
        socket.on('serverTellPlayerMove', function (userData, nodesList, webList, connectWeb, map) {
            var playerData;
            for (var i = 0; i < userData.length; i++) {
                if (typeof(userData[i].id) === "undefined") {
                    playerData = userData[i];
                    i = userData.length;
                }
            }

            var xoffset = this.player.x - playerData.x;
            var yoffset = this.player.y - playerData.y;

            this.player.x = playerData.x;
            this.player.y = playerData.y;
            this.player.hue = playerData.hue;
            this.player.massTotal = playerData.massTotal;
            this.player.xoffset = isNaN(xoffset) ? 0 : xoffset;
            this.player.yoffset = isNaN(yoffset) ? 0 : yoffset;
            global.player = this.player;

            global.users = userData;
            global.nodes = nodesList;
            global.spiderWeb = webList;
            global.connectWeb = connectWeb;
            global.map = map;
        });

        // Death.
        socket.on('RIP', function () {
            global.gameStart = false;
            global.died = true;
            window.setTimeout(function () {
                document.getElementById('gameAreaWrapper').style.opacity = 0;
                document.getElementById('startMenuWrapper').style.maxHeight = '1000px';
                global.died = false;
                if (global.animLoopHandle) {
                    window.cancelAnimationFrame(global.animLoopHandle);
                    global.animLoopHandle = undefined;
                }
            }, 2500);
        });

        socket.on('kick', function (data) {
            global.gameStart = false;
            global.kicked = true;
            socket.close();
        });


    }
}

function resize() {
    if (!global.socket) return;

    global.player.screenWidth = global.control.cv.width = global.screenWidth =  window.innerWidth;
    global.player.screenHeight = global.control.cv.height = global.screenHeight =  window.innerHeight;

    global.socket.emit('windowResized', {screenWidth: global.screenWidth, screenHeight: global.screenHeight});
}

module.exports = SocketClient;
