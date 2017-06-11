/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var SAT = require('sat');
var sql = require("mysql");
var _ = require("lodash");

// Import game settings.
var c = require('../../config.json');

// Import utilities.
var util = require('./lib/util');

// Import quadtree.
var quadtree = require('simple-quadtree');

//call sqlinfo
var s = c.sqlinfo;

var tree = quadtree(0, 0, c.gameWidth, c.gameHeight);

var users = [];
var node = [];
var map = new Array(Math.floor(c.gameWidth/c.gridGap));
for(var i=0; i<map.length; i++) {
    map[i] = new Array(Math.floor(c.gameHeight/c.gridGap));
}
var spiderWeb = [];
var connectWeb = [];

var sockets = {};

var initMassLog = util.log(c.defaultPlayerMass, c.slowBase);

var leaderboard = [];
var leaderboardChanged = false;

var V = SAT.Vector;
var C = SAT.Circle;

var pool = sql.createConnection({
    host: s.host,
    user: s.user,
    password: s.password,
    database: s.database
});

var spiderColorsHue = [0, 10, 30, 50, 70, 100, 190, 210, 240, 270, 300, 320];
var killSpeed = 10;

//log sql errors
pool.connect(function (err) {
    if (err) {
        console.log(err);
    }
});

app.use(express.static(__dirname + '/../client'));


Math.dist = function (x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
};


function addNode() {
    var grid = util.gridPosition();
    var radius = 10;
    for (var i = 0; i < grid.length; i++) {
        node.push({
            // Make IDs unique.
            id: ((new Date()).getTime()),
            x: grid[i].x,
            y: grid[i].y,
            radius: radius,
            mass: 10,
            hue: 0
        });
    }
}


io.on('connection', function (socket) {
    console.log('A user connected!');

    var radius = util.massToRadius(c.defaultPlayerMass);
    var position = c.newPlayerInitialPosition === 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);


    var currentPlayer = {
        id: socket.id,
        x: position.x,
        y: position.y,
        w: c.defaultPlayerMass,
        h: c.defaultPlayerMass,
        cells: [],
        massTotal: c.defaultPlayerMass,
        webAttach: null,
        startingWeb: null,
        hue: spiderColorsHue[Math.round(Math.random() * spiderColorsHue.length)],
        lastHeartbeat: new Date().getTime(),
        killed: false,
        target: {
            x: 0,
            y: 0
        }
    };

    socket.on('gotit', function (player) {
        console.log('[INFO] Player ' + player.name + ' connecting!');

        if (util.findIndex(users, player.id) > -1) {
            console.log('[INFO] Player ID is already connected, kicking.');
            socket.disconnect();
        } else if (!util.validNick(player.name)) {
            socket.emit('kick', 'Invalid username.');
            socket.disconnect();
        } else {
            console.log('[INFO] Player ' + player.name + ' connected!');
            sockets[player.id] = socket;

            var radius = util.massToRadius(c.defaultPlayerMass);
            var position = c.newPlayerInitialPosition === 'farthest' ? util.uniformPosition(users, radius) : util.randomPosition(radius);

            player.x = position.x;
            player.y = position.y;
            player.target.x = 0;
            player.target.y = 0;

            player.cells = [{
                mass: c.defaultPlayerMass,
                x: position.x,
                y: position.y,
                radius: radius
            }];
            player.massTotal = c.defaultPlayerMass;

            currentPlayer = player;
            currentPlayer.lastHeartbeat = new Date().getTime();
            users.push(currentPlayer);
            addNode();
            initWebPosition(currentPlayer);


            io.emit('playerJoin', {name: currentPlayer.name});

            socket.emit('gameSetup', {
                gameWidth: c.gameWidth,
                gameHeight: c.gameHeight
            });
            console.log('Total players: ' + users.length);
        }

    });

    socket.on('pingcheck', function () {
        socket.emit('pongcheck');
    });

    socket.on('windowResized', function (data) {
        currentPlayer.screenWidth = data.screenWidth;
        currentPlayer.screenHeight = data.screenHeight;
    });

    socket.on('respawn', function () {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        socket.emit('welcome', currentPlayer);
        console.log('[INFO] User ' + currentPlayer.name + ' respawned!');
    });

    socket.on('disconnect', function () {
        if (util.findIndex(users, currentPlayer.id) > -1)
            users.splice(util.findIndex(users, currentPlayer.id), 1);
        console.log('[INFO] User ' + currentPlayer.name + ' disconnected!');

        socket.broadcast.emit('playerDisconnect', {name: currentPlayer.name});

        removePlayerWeb(currentPlayer);
    });

    socket.on('playerChat', function (data) {
        var _sender = data.sender.replace(/(<([^>]+)>)/ig, '');
        var _message = data.message.replace(/(<([^>]+)>)/ig, '');
        if (c.logChat === 1) {
            console.log('[CHAT] [' + (new Date()).getHours() + ':' + (new Date()).getMinutes() + '] ' + _sender + ': ' + _message);
        }
        socket.broadcast.emit('serverSendPlayerChat', {sender: _sender, message: _message.substring(0, 35)});
    });

    socket.on('pass', function (data) {
        if (data[0] === c.adminPass) {
            console.log('[ADMIN] ' + currentPlayer.name + ' just logged in as an admin!');
            socket.emit('serverMSG', 'Welcome back ' + currentPlayer.name);
            socket.broadcast.emit('serverMSG', currentPlayer.name + ' just logged in as admin!');
            currentPlayer.admin = true;
        } else {

            // TODO: Actually log incorrect passwords.
            console.log('[ADMIN] ' + currentPlayer.name + ' attempted to log in with incorrect password.');
            socket.emit('serverMSG', 'Password incorrect, attempt logged.');
            pool.query('INSERT INTO logging SET name=' + currentPlayer.name + ', reason="Invalid login attempt as admin"');
        }
    });

    socket.on('kick', function (data) {
        removePlayerWeb(currentPlayer);
        if (currentPlayer.admin) {
            var reason = '';
            var worked = false;
            for (var e = 0; e < users.length; e++) {
                if (users[e].name === data[0] && !users[e].admin && !worked) {
                    if (data.length > 1) {
                        for (var f = 1; f < data.length; f++) {
                            if (f === data.length) {
                                reason = reason + data[f];
                            }
                            else {
                                reason = reason + data[f] + ' ';
                            }
                        }
                    }
                    if (reason !== '') {
                        console.log('[ADMIN] User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name + ' for reason ' + reason);
                    }
                    else {
                        console.log('[ADMIN] User ' + users[e].name + ' kicked successfully by ' + currentPlayer.name);
                    }
                    socket.emit('serverMSG', 'User ' + users[e].name + ' was kicked by ' + currentPlayer.name);
                    sockets[users[e].id].emit('kick', reason);
                    sockets[users[e].id].disconnect();
                    users.splice(e, 1);
                    worked = true;
                }
            }
            if (!worked) {
                socket.emit('serverMSG', 'Could not locate user or user is an admin.');
            }
        } else {
            console.log('[ADMIN] ' + currentPlayer.name + ' is trying to use -kick but isn\'t an admin.');
            socket.emit('serverMSG', 'You are not permitted to use this command.');
        }
    });

    // Heartbeat function, update everytime.
    socket.on('0', function (target) {
        currentPlayer.lastHeartbeat = new Date().getTime();
        if (target.x !== currentPlayer.x || target.y !== currentPlayer.y) {
            currentPlayer.target = target;
        }
    });

    socket.on("mouseUPShooting", function () {
        if (currentPlayer.webAttach === null) return;
        let closest = {x:0,y:0};

        //Check boundaries if player is outside map
        if (currentPlayer.x > c.gameWidth + 1) {

            closest = {
                x: c.gameWidth,
                y: Math.round(currentPlayer.y / c.gridGap) * c.gridGap
            };

        } else if (currentPlayer.x < 0) {
            closest = {
                x: 0,
                y: Math.round(currentPlayer.y / c.gridGap) * c.gridGap
            };
        } else if (currentPlayer.y > c.gameHeight + 1) {
            closest = {
                x: Math.round(currentPlayer.x / c.gridGap) * c.gridGap,
                y: c.gameHeight,
            };
        } else if (currentPlayer.y < 0) {
            closest = {
                x: Math.round(currentPlayer.x / c.gridGap) * c.gridGap,
                y: 0
            };
        } else {
            //return closest node point on the grid
            closest = {
                x: Math.round(currentPlayer.x / c.gridGap) * c.gridGap,
                y: Math.round(currentPlayer.y / c.gridGap) * c.gridGap
            };
        }


        connectWeb.map((el) => {
            if (el.player.id === currentPlayer.id) {
                el.nodes.push(closest, currentPlayer.startingWeb, currentPlayer.webAttach);

                fillMap(closest, currentPlayer.webAttach, currentPlayer.startingWeb, currentPlayer.id);
            }
        });

        currentPlayer.webAttach = null;
        currentPlayer.startingWeb = null;
        sockets[currentPlayer.id].emit("receiveShootingNode", null);
        sockets[currentPlayer.id].emit("receiveShootingNodeStarting", null);
    });

    function fillMap(point0,point1,point2, ID) {
        
        var p0 = {}, p1 = {}, p2 = {};
        //a -> b
        p0.x = point1.x / c.gridGap - point0.x / c.gridGap;
        p0.y = point1.y / c.gridGap - point0.y / c.gridGap;
        //a -> c
        p1.x = point2.x / c.gridGap - point0.x / c.gridGap;
        p1.y = point2.y / c.gridGap - point0.y / c.gridGap;
        //a -> p
        p2.x =  - point0.x / c.gridGap;
        p2.y =  - point0.y / c.gridGap;

        var dot00, dot01, dot02, dot11, dot12;
        dot00 = p0.x*p0.x + p0.y*p0.y;
        dot01 = p0.x*p1.x + p0.y*p1.y;
        dot11 = p1.x*p1.x + p1.y*p1.y;

        //console.log("fillMap() ---------------");

        //console.log(p0.x+","+p0.y);
        //console.log(p1.x+","+p1.y);

        var maxX = Math.max(point0.x / c.gridGap, point1.x / c.gridGap, point2.x / c.gridGap);
        var minX = Math.min(point0.x / c.gridGap, point1.x / c.gridGap, point2.x / c.gridGap);
        var maxY = Math.max(point0.y / c.gridGap, point1.y / c.gridGap, point2.y / c.gridGap);
        var minY = Math.min(point0.y / c.gridGap, point1.y / c.gridGap, point2.y / c.gridGap);

        //console.log(`${minX}, ${maxX}`);
        //console.log(`${minY}, ${maxY}`);

        //console.log("squares ---------------");
        for(var x = minX; x < maxX; x++) {
            for(var y = minY; y < maxY; y++) {

                p2.x = (x+0.5) - point0.x / c.gridGap;
                p2.y = (y+0.5) - point0.y / c.gridGap;
                dot02 = p0.x*p2.x + p0.y*p2.y;
                dot12 = p1.x*p2.x + p1.y*p2.y;

                var invDenom = 1 / (dot00 * dot11 - dot01 * dot01);
                var u = (dot11 * dot02 - dot01 * dot12) * invDenom;
                var v = (dot00 * dot12 - dot01 * dot02) * invDenom;

                //console.log(`(${p2.x}, ${p2.y}) u:${u} v:${v}`);

                if( (u >= 0) && (v >= 0) && (u + v <= 1) ) {
                    //console.log(x+","+y);
                    map[x][y] = ID;
                }
            }
        }

    }

    socket.on("deleteWebAttach", function () {
        currentPlayer.webAttach = null;
        currentPlayer.startingWeb = null;
        sockets[currentPlayer.id].emit("receiveShootingNode", null);
        sockets[currentPlayer.id].emit("receiveShootingNodeStarting", null);
    });


    //called when a player starts shooting web
    socket.on("shooting", function (direction, dist) {
        currentPlayer.lastHeartbeat = new Date().getTime();

        //check if the player is currently shooting web
        for (var i = 0; i < spiderWeb.length; i++) {
            var w = spiderWeb[i];
            if (w.player === currentPlayer) {
                return;
            }
        }

        //Check if the player has clicked on a other player, if so kill him
        users.map((player, index) => {
            if (player.id !== currentPlayer.id) {
                if (Math.dist(player.x, player.y, (currentPlayer.x + dist.x), (currentPlayer.y + dist.y)) < 10) {
                    console.log(currentPlayer.name + ' has KILLED ' + player.name);
                    player.killed = true;
                    removePlayerWeb(player);
                    setTimeout(()=>{
                        users.splice(index, 1);
                        player.killed = false;
                        io.emit('playerDied', {name: player.name});
                        sockets[player.id].emit('RIP');
                    }, 1000);
                }
            }
        });

        let position = {
            x: Math.round((currentPlayer.x + dist.x) / c.gridGap) * c.gridGap,
            y: Math.round((currentPlayer.y + dist.y) / c.gridGap) * c.gridGap
        };

        if (position.x > c.gameWidth || position.x < 0 || position.y > c.gameHeight || position.y < 0) {
            return;
        }

        currentPlayer.startingWeb = {
            x: Math.round((currentPlayer.x) / c.gridGap) * c.gridGap,
            y: Math.round((currentPlayer.y) / c.gridGap) * c.gridGap
        };

        spiderWeb.push({
            player: currentPlayer,
            dir: direction,
            endPoint: {
                x: currentPlayer.x + 10 * direction.x,
                y: currentPlayer.y + 10 * direction.y
            },
            isReturning: false,
            holding: null
        });

        currentPlayer.webAttach = position;
        sockets[currentPlayer.id].emit("receiveShootingNode", position);
        sockets[currentPlayer.id].emit("receiveShootingNodeStarting", currentPlayer.startingWeb);
    });
});

function removePlayerWeb(player) {
    connectWeb = connectWeb.filter((web) => {
        return web.player.id !== player.id;
    });

    for(var i=0; i<map.length; i++) {
        for(var j=0; j<map[0].length; j++) {
            if(player.id == map[i][j]) {
                map[i][j] = null;
            }
        }
    }
}

function initWebPosition(player) {
    let myGap = c.gridGap;
    let x = myGap;
    let y = myGap;
    let idx = 0;
    for (var i = 0; i < 4; i++) {

        if (i === 0) {
            connectWeb.push({
                player: player,
                nodes: [{x: player.x - x, y: player.y}, {x: player.x, y: player.y - y}, {x: player.x, y: player.y}]
            });
            idx = connectWeb.length - 1;
        } else {
            connectWeb[idx].nodes.push({x: player.x - x, y: player.y}, {x: player.x, y: player.y -y}, {
                x: player.x,
                y: player.y
            });
        }

        var x1 = Math.floor((player.x - x/2) / c.gridGap);
        var y1 = Math.floor((player.y - y/2) / c.gridGap);
        map[x1][y1] = player.id;

        x = -x;
        y = -y;
        let a = i === 1 ? x = -y : null;
    }
}

function isOnOwnWeb(playerID, playerX, playerY) {
    let mapX = Math.floor(playerX / c.gridGap);
    let mapY = Math.floor(playerY / c.gridGap);

    //if web dosnt have player id is not own web
    if (map[mapX][mapY] != playerID)
        return false;
    else
        return true;

    /*
     //if all nodes are connected then player is in web
     if( map[mapX][mapY].nodes.length == 4 )
     return true;
     else if( map[mapX][mapY].nodes.length < 3 )
     return false;

     let localX = playerX % gridGap;
     let localY = playerY % gridGap;

     let pos = localY < localX;
     let neg = localY < gridGap - localX;

     */
}

function movePlayer(player) {

    if (player.killed) {
        player.y += killSpeed;
        player.cells[0].y += killSpeed;
        return;
    }

    var target;
    if (player.webAttach === null) {

        var x = 0, y = 0;
        for (var i = 0; i < player.cells.length; i++) {
            target = {
                x: player.x - player.cells[i].x + player.target.x,
                y: player.y - player.cells[i].y + player.target.y
            };
            var dist = Math.sqrt(Math.pow(target.y, 2) + Math.pow(target.x, 2));
            var deg = Math.atan2(target.y, target.x);
            var slowDown = 1;
            if (player.cells[i].speed <= 6.25) {
                slowDown = util.log(player.cells[i].mass, c.slowBase) - initMassLog + 1;
            }

            var deltaY = player.cells[i].speed * Math.sin(deg) / slowDown;
            var deltaX = player.cells[i].speed * Math.cos(deg) / slowDown;

            if (player.cells[i].speed > 6.25) {
                player.cells[i].speed -= 0.5;
            }
            if (dist < (50 + player.cells[i].radius)) {
                deltaY *= dist / (50 + player.cells[i].radius);
                deltaX *= dist / (50 + player.cells[i].radius);
            }
            if (!isNaN(deltaY)) {
                player.cells[i].y += deltaY;
            }
            if (!isNaN(deltaX)) {
                player.cells[i].x += deltaX;
            }
            // Find best solution.
            for (var j = 0; j < player.cells.length; j++) {
                if (j != i && player.cells[i] !== undefined) {

                    var distance = Math.sqrt(Math.pow(player.cells[j].y - player.cells[i].y, 2) + Math.pow(player.cells[j].x - player.cells[i].x, 2));

                    var radiusTotal = (player.cells[i].radius + player.cells[j].radius);
                    if (distance < radiusTotal) {
                        if (player.lastSplit > new Date().getTime() - 1000 * c.mergeTimer) {
                            if (player.cells[i].x < player.cells[j].x) {
                                player.cells[i].x--;
                            } else if (player.cells[i].x > player.cells[j].x) {
                                player.cells[i].x++;
                            }
                            if (player.cells[i].y < player.cells[j].y) {
                                player.cells[i].y--;
                            } else if ((player.cells[i].y > player.cells[j].y)) {
                                player.cells[i].y++;
                            }
                        }
                        else if (distance < radiusTotal / 1.75) {
                            player.cells[i].mass += player.cells[j].mass;
                            player.cells[i].radius = util.massToRadius(player.cells[i].mass);
                            player.cells.splice(j, 1);
                        }
                    }
                }
            }
            if (player.cells.length > i) {
                var borderCalc = player.cells[i].radius / 3;
                if (player.cells[i].x > c.gameWidth - borderCalc) {
                    player.cells[i].x = c.gameWidth - borderCalc;
                }
                if (player.cells[i].y > c.gameHeight - borderCalc) {
                    player.cells[i].y = c.gameHeight - borderCalc;
                }
                if (player.cells[i].x < borderCalc) {
                    player.cells[i].x = borderCalc;
                }
                if (player.cells[i].y < borderCalc) {
                    player.cells[i].y = borderCalc;
                }
                x += player.cells[i].x;
                y += player.cells[i].y;
            }
        }
        player.x = x / player.cells.length;
        player.y = y / player.cells.length;


    }


    if (player.webAttach !== null) {

        var pos = {x: player.x, y: player.y};


        target = {
            x: player.x - player.cells[0].x + player.target.x,
            y: 1
        };

        var r = Math.dist(player.webAttach.x, player.webAttach.y, player.x, player.y);
        //Faster when the spider is under the center point
        //Slower when he is far away
        var diffX = Math.abs(player.webAttach.x - pos.x);
        var value = diffX > 0.2 ? 10 + (r / 100) + (1 / diffX * 15) : 3;
        if (target.x > 0) {
            pos.x += value;
        }
        else if (target.x < 0) {
            pos.x -= value;
        }

        if (target.y > 0) {
            pos.y += 6;
        }


        //Where r is the radius, cx,cy the origin, and a the angle.
        var a = Math.atan2(pos.y - player.webAttach.y, pos.x - player.webAttach.x);
        player.x = player.webAttach.x + r * Math.cos(a);
        player.y = player.webAttach.y + r * Math.sin(a);
        player.cells[0].x = player.x;
        player.cells[0].y = player.y;
    }



}


function tickPlayer(currentPlayer) {
    if (currentPlayer.lastHeartbeat < new Date().getTime() - c.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + c.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
    }

    movePlayer(currentPlayer);


    function check(user) {
        for (var i = 0; i < user.cells.length; i++) {
            if (user.cells[i].mass > 10 && user.id !== currentPlayer.id) {
                var response = new SAT.Response();
                var collided = SAT.testCircleCircle(playerCircle,
                    new C(new V(user.cells[i].x, user.cells[i].y), user.cells[i].radius),
                    response);
                if (collided) {
                    response.aUser = currentCell;
                    response.bUser = {
                        id: user.id,
                        name: user.name,
                        x: user.cells[i].x,
                        y: user.cells[i].y,
                        num: i,
                        mass: user.cells[i].mass
                    };
                    playerCollisions.push(response);
                }
            }
        }
        return true;
    }

    function collisionCheck(collision) {
        if (collision.aUser.mass > collision.bUser.mass * 1.1 && collision.aUser.radius > Math.sqrt(Math.pow(collision.aUser.x - collision.bUser.x, 2) + Math.pow(collision.aUser.y - collision.bUser.y, 2)) * 1.75) {
            console.log('[DEBUG] Killing user: ' + collision.bUser.id);
            console.log('[DEBUG] Collision info:');
            console.log(collision);

            var numUser = util.findIndex(users, collision.bUser.id);
            if (numUser > -1) {
                if (users[numUser].cells.length > 1) {
                    users[numUser].massTotal -= collision.bUser.mass;
                    users[numUser].cells.splice(collision.bUser.num, 1);
                } else {
                    users.splice(numUser, 1);
                    io.emit('playerDied', {name: collision.bUser.name});
                    sockets[collision.bUser.id].emit('RIP');
                }
            }
            currentPlayer.massTotal += collision.bUser.mass;
            collision.aUser.mass += collision.bUser.mass;
        }
    }

    for (var z = 0; z < currentPlayer.cells.length; z++) {
        var currentCell = currentPlayer.cells[z];
        var playerCircle = new C(
            new V(currentCell.x, currentCell.y),
            currentCell.radius
        );


        if (typeof(currentCell.speed) == "undefined")
            currentCell.speed = 6.25;
        currentCell.radius = util.massToRadius(currentCell.mass);
        playerCircle.r = currentCell.radius;

        tree.clear();
        users.forEach(tree.put);
        var playerCollisions = [];

        var otherUsers = tree.get(currentPlayer, check);

        playerCollisions.forEach(collisionCheck);
    }
}

function moveloop() {
    for (var i = 0; i < users.length; i++) {
        tickPlayer(users[i]);
    }


    for (i = 0; i < spiderWeb.length; i++) {
        let web = spiderWeb[i];


        if (!web.isReturning) {
            web.endPoint.x += web.dir.x * c.spiderWebSpeed;
            web.endPoint.y += web.dir.y * c.spiderWebSpeed;
        }
        else {
            web.endPoint.x += (web.player.x - web.endPoint.x) * 0.2;
            web.endPoint.y += (web.player.y - web.endPoint.y) * 0.2;
        }

        let x = web.endPoint.x - web.player.x;
        let y = web.endPoint.y - web.player.y;
        let dist = Math.sqrt(x * x + y * y);
        if (web.isReturning && dist < 27) {
            spiderWeb.splice(i, 1);
            i--;
        }
        else if (dist > c.spiderWebRange) {
            web.isReturning = true;
        }
    }
}

function gameloop() {
    if (users.length > 0) {
        users.sort(function (a, b) {
            return b.massTotal - a.massTotal;
        });

        var topUsers = [];

        for (var i = 0; i < Math.min(10, users.length); i++) {

            topUsers.push({
                id: users[i].id,
                name: users[i].name
            });

        }
        if (isNaN(leaderboard) || leaderboard.length !== topUsers.length) {
            leaderboard = topUsers;
            leaderboardChanged = true;
        }
        else {
            for (i = 0; i < leaderboard.length; i++) {
                if (leaderboard[i].id !== topUsers[i].id) {
                    leaderboard = topUsers;
                    leaderboardChanged = true;
                    break;
                }
            }
        }
    }
}

function sendUpdates() {
    users.forEach(function (u) {

        var visibleNode = node
            .map(function (f) {
                if (f.x > u.x - u.screenWidth / 2 - 20 &&
                    f.x < u.x + u.screenWidth / 2 + 20 &&
                    f.y > u.y - u.screenHeight / 2 - 20 &&
                    f.y < u.y + u.screenHeight / 2 + 20) {
                    return f;
                }
            })
            .filter(function (f) {
                return f;
            });

        var visibleSpiderWeb = spiderWeb
            .map(function (w) {
                if ((w.player.x > u.x - u.screenWidth / 2 - 20 &&
                        w.player.x < u.x + u.screenWidth / 2 + 20 &&
                        w.player.y > u.y - u.screenHeight / 2 - 20 &&
                        w.player.y < u.y + u.screenHeight / 2 + 20
                    ) || (
                    w.endPoint.x > u.x - u.screenWidth / 2 - 20 &&
                    w.endPoint.x < u.x + u.screenWidth / 2 + 20 &&
                    w.endPoint.y > u.y - u.screenHeight / 2 - 20 &&
                    w.endPoint.y < u.y + u.screenHeight / 2 + 20)) {
                    return w;
                }
            })
            .filter(function (w) {
                return w;
            });


        var visibleConnectWeb = connectWeb
            .map(function (w) {
                w.nodes.map((el) => {
                    if (el.x > u.x - u.screenWidth / 2 - 20 &&
                        el.x < u.x + u.screenWidth / 2 + 20 &&
                        el.y > u.y - u.screenHeight / 2 - 20 &&
                        el.y < u.y + u.screenHeight / 2 + 20) {
                        return el;
                    }
                });
                return w;
            })
            .filter(function (w) {
                return w;
            });

        var visibleCells = users
            .map(function (f) {
                for (var z = 0; z < f.cells.length; z++) {
                    if (f.cells[z].x + f.cells[z].radius > u.x - u.screenWidth / 2 - 20 &&
                        f.cells[z].x - f.cells[z].radius < u.x + u.screenWidth / 2 + 20 &&
                        f.cells[z].y + f.cells[z].radius > u.y - u.screenHeight / 2 - 20 &&
                        f.cells[z].y - f.cells[z].radius < u.y + u.screenHeight / 2 + 20) {
                        z = f.cells.lenth;
                        if (f.id !== u.id) {
                            return {
                                id: f.id,
                                x: f.x,
                                y: f.y,
                                cells: f.cells,
                                webAttach: f.webAttach,
                                massTotal: Math.round(f.massTotal),
                                hue: f.hue,
                                name: f.name
                            };
                        } else {
                            return {
                                x: f.x,
                                y: f.y,
                                cells: f.cells,
                                webAttach: f.webAttach,
                                massTotal: Math.round(f.massTotal),
                                hue: f.hue
                            };
                        }
                    }
                }
            })
            .filter(function (f) {
                return f;
            });

        var min = {};
        min.x = Math.floor((u.x - u.screenWidth / 2) / c.gridGap);
        min.y = Math.floor((u.y - u.screenHeight / 2) / c.gridGap);
        
        var max = {};
        max.x = Math.ceil((u.x + u.screenWidth / 2) / c.gridGap);
        max.y = Math.ceil((u.y + u.screenHeight / 2) / c.gridGap);

        if(min.x < 0) min.x = 0;
        if(min.y < 0) min.y = 0;
        if(max.x > c.gameWidth/c.gridGap) max.x = c.gameWidth/c.gridGap;
        if(max.x > c.gameHeight/c.gridGap) max.x = c.gameHeight/c.gridGap;
        
        var visibleMap = map.slice(min.x, max.x+1);
        for(var i=0; i<visibleMap.length; i++) {
            visibleMap[i] = visibleMap[i].slice(min.y, max.y+1); 
        }

        sockets[u.id].emit('serverTellPlayerMove', visibleCells, visibleNode, visibleSpiderWeb, visibleConnectWeb, visibleMap);
        if (leaderboardChanged) {
            sockets[u.id].emit('leaderboard', {
                players: users.length,
                leaderboard: leaderboard
            });
        }
    });
    leaderboardChanged = false;
}

setInterval(moveloop, 1000 / 60);
setInterval(gameloop, 1000);
setInterval(sendUpdates, 1000 / c.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || c.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || c.port;
http.listen(serverport, ipaddress, function () {
    console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});
