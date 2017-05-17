var io = require('socket.io-client');

var Canvas = require('./canvas');

var global = require('./global');



var playerNameInput = document.getElementById('playerNameInput');
var socket;
var reason;

var debug = function (args) {
    if (console && console.log) {
        console.log(args);
    }
};

if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
    global.mobile = true;
}

function startGame(type) {
    global.playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '').substring(0, 25);
    global.playerType = type;

    global.screenWidth = window.innerWidth;
    global.screenHeight = window.innerHeight;

    document.getElementById('startMenuWrapper').style.maxHeight = '0px';
    document.getElementById('gameAreaWrapper').style.opacity = 1;
    if (!socket) {
        socket = io({query: "type=" + type});
        setupSocket(socket);
    }
    if (!global.animLoopHandle)
        animloop();
    socket.emit('respawn');
    window.canvas.socket = socket;
    global.socket = socket;
}

// Checks if the nick chosen contains valid alphanumeric characters (and underscores).
function validNick() {
    var regex = /^\w*$/;
    debug('Regex Test', regex.exec(playerNameInput.value));
    return regex.exec(playerNameInput.value) !== null;
}

window.onload = function () {

    var btn = document.getElementById('startButton'),
        btnS = document.getElementById('spectateButton'),
        nickErrorText = document.querySelector('#startMenu .input-error');

    btnS.onclick = function () {
        startGame('spectate');
    };

    btn.onclick = function () {

        console.log(playerNameInput.value);

        // Checks if the nick is valid and not empty
        if (validNick() && playerNameInput.value !== "" ) {
            nickErrorText.style.opacity = 0;
            startGame('player');
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
            if (validNick()) {
                nickErrorText.style.opacity = 0;
                startGame('player');
            } else {
                nickErrorText.style.opacity = 1;
            }
        }
    });
};


var foodConfig = {
    border: 0,
};

var nodeConfig = {
    border: 0,
};

var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

var player = {
    id: -1,
    x: global.screenWidth / 2,
    y: global.screenHeight / 2,
    screenWidth: global.screenWidth,
    screenHeight: global.screenHeight,
    target: {x: global.screenWidth / 2, y: global.screenHeight / 2}
};
global.player = player;

var foods = [];
var nodes = [];
var fireFood = [];
var users = [];
var leaderboard = [];
var target = {x: player.x, y: player.y};
global.target = target;

window.canvas = new Canvas();


var visibleBorderSetting = document.getElementById('visBord');
visibleBorderSetting.onchange = settings.toggleBorder;

var showMassSetting = document.getElementById('showMass');
showMassSetting.onchange = settings.toggleMass;

var continuitySetting = document.getElementById('continuity');
continuitySetting.onchange = settings.toggleContinuity;

var roundFoodSetting = document.getElementById('roundFood');
roundFoodSetting.onchange = settings.toggleRoundFood;

var c = window.canvas.cv;
var context = c.getContext('2d');

$("#feed").click(function () {
    socket.emit('1');
    window.canvas.reenviar = false;
});

$("#split").click(function () {
    socket.emit('2');
    window.canvas.reenviar = false;
});

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
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
        player = playerSettings;
        player.name = global.playerName;
        player.screenWidth = global.screenWidth;
        player.screenHeight = global.screenHeight;
        player.target = window.canvas.target;
        global.player = player;
        socket.emit('gotit', player);
        global.gameStart = true;
        debug('Game started at: ' + global.gameStart);
        c.focus();
    });

    socket.on('gameSetup', function (data) {
        global.gameWidth = data.gameWidth;
        global.gameHeight = data.gameHeight;
        resize();
    });

    socket.on('playerDied', function (data) {
        //A OTHER PLAYER DIED
    });

    socket.on('playerDisconnect', function (data) {
        //A OTHER PLAYER DISCONNECT
    });

    socket.on('playerJoin', function (data) {
        //A OTHER PLAYER JOIN
    });

    socket.on('leaderboard', function (data) {
        leaderboard = data.leaderboard;
        var status = '<span class="title">Leaderboard</span>';
        for (var i = 0; i < leaderboard.length; i++) {
            status += '<br />';
            if (leaderboard[i].id === player.id) {
                if (leaderboard[i].name.length !== 0)
                    status += '<span class="me">' + (i + 1) + '. ' + leaderboard[i].name + "</span>";
                else
                    status += '<span class="me">' + (i + 1) + ". An unnamed cell</span>";
            } else {
                if (leaderboard[i].name.length !== 0)
                    status += (i + 1) + '. ' + leaderboard[i].name;
                else
                    status += (i + 1) + '. An unnamed cell';
            }
        }
        document.getElementById('status').innerHTML = status;
    });

    socket.on('serverMSG', function (data) {

    });

    // Chat.
    socket.on('serverSendPlayerChat', function (data) {

    });

    // Handle movement.
    socket.on('serverTellPlayerMove', function (userData, foodsList, massList, nodesList) {
        var playerData;
        for (var i = 0; i < userData.length; i++) {
            if (typeof(userData[i].id) === "undefined") {
                playerData = userData[i];
                i = userData.length;
            }
        }
        if (global.playerType === 'player') {
            var xoffset = player.x - playerData.x;
            var yoffset = player.y - playerData.y;

            player.x = playerData.x;
            player.y = playerData.y;
            player.hue = playerData.hue;
            player.massTotal = playerData.massTotal;
            player.cells = playerData.cells;
            player.xoffset = isNaN(xoffset) ? 0 : xoffset;
            player.yoffset = isNaN(yoffset) ? 0 : yoffset;
        }
        users = userData;
        foods = foodsList;
        nodes = nodesList;
        fireFood = massList;
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
        reason = data;
        global.kicked = true;
        socket.close();
    });


}

function drawCircle(centerX, centerY, radius, sides) {
    var theta = 0;
    var x = 0;
    var y = 0;

    context.beginPath();

    for (var i = 0; i < sides; i++) {
        theta = (i / sides) * 2 * Math.PI;
        x = centerX + radius * Math.sin(theta);
        y = centerY + radius * Math.cos(theta);
        context.lineTo(x, y);
    }

    context.closePath();
    context.stroke();
    context.fill();
}

function drawFood(food) {
    context.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    context.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    context.lineWidth = foodConfig.border;
    drawCircle(food.x - player.x + global.screenWidth / 2,
        food.y - player.y + global.screenHeight / 2,
        food.radius, global.foodSides);
}


function drawNode(node) {
    context.strokeStyle = '#000';
    context.fillStyle = '#000';
    context.lineWidth = nodeConfig.border;
    console.log(node);
    drawCircle(node.x - player.x + global.screenWidth / 2,
        node.y - player.y + global.screenHeight / 2,
        node.radius, global.nodeSides);
}

function drawFireFood(mass) {
    context.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    context.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    context.lineWidth = playerConfig.border + 10;
    drawCircle(mass.x - player.x + global.screenWidth / 2,
        mass.y - player.y + global.screenHeight / 2,
        mass.radius - 5, 18 + (~~(mass.masa / 5)));
}

function drawPlayers(order) {
    var start = {
        x: player.x - (global.screenWidth / 2),
        y: player.y - (global.screenHeight / 2)
    };

    for (var z = 0; z < order.length; z++) {
        var userCurrent = users[order[z].nCell];
        var cellCurrent = users[order[z].nCell].cells[order[z].nDiv];

        var x = 0;
        var y = 0;

        var points = 30 + ~~(cellCurrent.mass / 5);
        var increase = Math.PI * 2 / points;

        context.strokeStyle = 'hsl(' + userCurrent.hue + ', 100%, 45%)';
        context.fillStyle = 'hsl(' + userCurrent.hue + ', 100%, 50%)';
        context.lineWidth = playerConfig.border;

        var xstore = [];
        var ystore = [];

        global.spin += 0.0;

        var circle = {
            x: cellCurrent.x - start.x,
            y: cellCurrent.y - start.y
        };

        for (var i = 0; i < points; i++) {

            x = cellCurrent.radius * Math.cos(global.spin) + circle.x;
            y = cellCurrent.radius * Math.sin(global.spin) + circle.y;
            if (typeof(userCurrent.id) === "undefined") {
                x = valueInRange(-userCurrent.x + global.screenWidth / 2,
                    global.gameWidth - userCurrent.x + global.screenWidth / 2, x);
                y = valueInRange(-userCurrent.y + global.screenHeight / 2,
                    global.gameHeight - userCurrent.y + global.screenHeight / 2, y);
            } else {
                x = valueInRange(-cellCurrent.x - player.x + global.screenWidth / 2 + (cellCurrent.radius / 3),
                    global.gameWidth - cellCurrent.x + global.gameWidth - player.x + global.screenWidth / 2 - (cellCurrent.radius / 3), x);
                y = valueInRange(-cellCurrent.y - player.y + global.screenHeight / 2 + (cellCurrent.radius / 3),
                    global.gameHeight - cellCurrent.y + global.gameHeight - player.y + global.screenHeight / 2 - (cellCurrent.radius / 3), y);
            }
            global.spin += increase;
            xstore[i] = x;
            ystore[i] = y;
        }
        /*if (wiggle >= player.radius/ 3) inc = -1;
         *if (wiggle <= player.radius / -3) inc = +1;
         *wiggle += inc;
         */
        for (i = 0; i < points; ++i) {
            if (i === 0) {
                context.beginPath();
                context.moveTo(xstore[i], ystore[i]);
            } else if (i > 0 && i < points - 1) {
                context.lineTo(xstore[i], ystore[i]);
            } else {
                context.lineTo(xstore[i], ystore[i]);
                context.lineTo(xstore[0], ystore[0]);
            }

        }
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.fill();
        context.stroke();
        var nameCell = "";
        if (typeof(userCurrent.id) === "undefined")
            nameCell = player.name;
        else
            nameCell = userCurrent.name;

        var fontSize = Math.max(cellCurrent.radius / 3, 12);
        context.lineWidth = playerConfig.textBorderSize;
        context.fillStyle = playerConfig.textColor;
        context.strokeStyle = playerConfig.textBorder;
        context.miterLimit = 1;
        context.lineJoin = 'round';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = 'bold ' + fontSize + 'px sans-serif';

        if (global.toggleMassState === 0) {
            context.strokeText(nameCell, circle.x, circle.y);
            context.fillText(nameCell, circle.x, circle.y);
        } else {
            context.strokeText(nameCell, circle.x, circle.y);
            context.fillText(nameCell, circle.x, circle.y);
            context.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
            if (nameCell.length === 0) fontSize = 0;
            context.strokeText(Math.round(cellCurrent.mass), circle.x, circle.y + fontSize);
            context.fillText(Math.round(cellCurrent.mass), circle.x, circle.y + fontSize);
        }
    }
}

function valueInRange(min, max, value) {
    return Math.min(max, Math.max(min, value));
}

function drawCursor () {

    context.lineWidth = 1;
    context.strokeStyle = global.lineColor;
    context.beginPath();

    context.arc(global.cursor.x, global.cursor.y, global.cursor.r, 0,2*Math.PI);
    context.fill();


}

function drawgrid() {
    context.lineWidth = 1;
    context.strokeStyle = global.lineColor;
    context.fillStyle = '#4c4c4c';
    context.beginPath();


    for (var x = global.xoffset - player.x; x < global.screenWidth; x += global.screenHeight / 18) {
        context.moveTo(x, 0);
        context.lineTo(x, global.screenHeight);
    }

    for (var y = global.yoffset - player.y; y < global.screenHeight; y += global.screenHeight / 18) {
        context.moveTo(0, y);
        context.lineTo(global.screenWidth, y);
    }

    context.fill();
}

function drawborder() {
    context.lineWidth = 1;
    context.strokeStyle = playerConfig.borderColor;

    // Left-vertical.
    if (player.x <= global.screenWidth / 2) {
        context.beginPath();
        context.moveTo(global.screenWidth / 2 - player.x, 0 ? player.y > global.screenHeight / 2 : global.screenHeight / 2 - player.y);
        context.lineTo(global.screenWidth / 2 - player.x, global.gameHeight + global.screenHeight / 2 - player.y);
        context.strokeStyle = global.lineColor;
        context.stroke();
    }

    // Top-horizontal.
    if (player.y <= global.screenHeight / 2) {
        context.beginPath();
        context.moveTo(0 ? player.x > global.screenWidth / 2 : global.screenWidth / 2 - player.x, global.screenHeight / 2 - player.y);
        context.lineTo(global.gameWidth + global.screenWidth / 2 - player.x, global.screenHeight / 2 - player.y);
        context.strokeStyle = global.lineColor;
        context.stroke();
    }

    // Right-vertical.
    if (global.gameWidth - player.x <= global.screenWidth / 2) {
        context.beginPath();
        context.moveTo(global.gameWidth + global.screenWidth / 2 - player.x,
            global.screenHeight / 2 - player.y);
        context.lineTo(global.gameWidth + global.screenWidth / 2 - player.x,
            global.gameHeight + global.screenHeight / 2 - player.y);
        context.strokeStyle = global.lineColor;
        context.stroke();
    }

    // Bottom-horizontal.
    if (global.gameHeight - player.y <= global.screenHeight / 2) {
        context.beginPath();
        context.moveTo(global.gameWidth + global.screenWidth / 2 - player.x,
            global.gameHeight + global.screenHeight / 2 - player.y);
        context.lineTo(global.screenWidth / 2 - player.x,
            global.gameHeight + global.screenHeight / 2 - player.y);
        context.strokeStyle = global.lineColor;
        context.stroke();
    }
}

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
    gameLoop();
}

function gameLoop() {
    if (global.died) {
        context.fillStyle = '#333333';
        context.fillRect(0, 0, global.screenWidth, global.screenHeight);

        context.textAlign = 'center';
        context.fillStyle = '#FFFFFF';
        context.font = 'bold 30px sans-serif';
        context.fillText('You died!', global.screenWidth / 2, global.screenHeight / 2);
    }
    else if (!global.disconnected) {
        if (global.gameStart) {
            context.fillStyle = global.backgroundColor;
            context.fillRect(0, 0, global.screenWidth, global.screenHeight);

            drawgrid();
            foods.forEach(drawFood);
            fireFood.forEach(drawFireFood);
            nodes.forEach(drawNode);
            drawCursor();

            if (global.borderDraw) {
                drawborder();
            }
            var orderMass = [];
            for (var i = 0; i < users.length; i++) {
                for (var j = 0; j < users[i].cells.length; j++) {
                    orderMass.push({
                        nCell: i,
                        nDiv: j,
                        mass: users[i].cells[j].mass
                    });
                }
            }
            orderMass.sort(function (obj1, obj2) {
                return obj1.mass - obj2.mass;
            });

            drawPlayers(orderMass);
            socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".

        } else {
            context.fillStyle = '#333333';
            context.fillRect(0, 0, global.screenWidth, global.screenHeight);

            context.textAlign = 'center';
            context.fillStyle = '#FFFFFF';
            context.font = 'bold 30px sans-serif';
            context.fillText('Game Over!', global.screenWidth / 2, global.screenHeight / 2);
        }
    } else {
        context.fillStyle = '#333333';
        context.fillRect(0, 0, global.screenWidth, global.screenHeight);

        context.textAlign = 'center';
        context.fillStyle = '#FFFFFF';
        context.font = 'bold 30px sans-serif';
        if (global.kicked) {
            if (reason !== '') {
                context.fillText('You were kicked for:', global.screenWidth / 2, global.screenHeight / 2 - 20);
                context.fillText(reason, global.screenWidth / 2, global.screenHeight / 2 + 20);
            }
            else {
                context.fillText('You were kicked!', global.screenWidth / 2, global.screenHeight / 2);
            }
        }
        else {
            context.fillText('Disconnected!', global.screenWidth / 2, global.screenHeight / 2);
        }
    }
}

window.addEventListener('resize', resize);

function resize() {
    if (!socket) return;

    player.screenWidth = c.width = global.screenWidth = global.playerType === 'player' ? window.innerWidth : global.gameWidth;
    player.screenHeight = c.height = global.screenHeight = global.playerType === 'player' ? window.innerHeight : global.gameHeight;

    if (global.playerType === 'spectate') {
        player.x = global.gameWidth / 2;
        player.y = global.gameHeight / 2;
    }

    socket.emit('windowResized', {screenWidth: global.screenWidth, screenHeight: global.screenHeight});
}
