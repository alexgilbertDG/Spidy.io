const global = require('./global');

const _ = {
    chunk: function chunk(array, size) {
        var chunks = [],
            i = 0,
            n = array.length;

        while (i < n) {
            chunks.push(array.slice(i, i += size));
        }

        return chunks;
    }
};



function valueInRange(min, max, value) {
    return Math.min(max, Math.max(min, value));
}

let context = global.control.cv.getContext('2d');

var nodeConfig = {
    border: 0
};
var playerConfig = {
    border: 6,
    textColor: '#FFFFFF',
    textBorder: '#000000',
    textBorderSize: 3,
    defaultSize: 30
};

class Drawing {
    constructor(ctx) {
        context = ctx;
    }

    static gameOver(msg) {
        context.fillStyle = '#333333';
        context.fillRect(0, 0, global.screenWidth, global.screenHeight);

        context.textAlign = 'center';
        context.fillStyle = '#FFFFFF';
        context.font = 'bold 30px sans-serif';
        context.fillText(msg, global.screenWidth / 2, global.screenHeight / 2);
    }

    static clear () {
        if ( context === "undefined" ) {
            context = window.control.cv.getContext('2d');
        }
        context.fillStyle = global.backgroundColor;
        context.fillRect(0, 0, global.screenWidth, global.screenHeight);
    }


    static drawCircle(centerX, centerY, radius, sides, fixed = false) {

        if (fixed) {
            centerX = centerX - global.player.x + global.screenWidth / 2;
            centerY = centerY - global.player.y + global.screenHeight / 2;
        }
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


    static drawCursor() {
        context.lineWidth = 1;
        context.strokeStyle = global.lineColor;
        context.beginPath();

        context.arc(global.cursor.x, global.cursor.y, global.cursor.r, 0, 2 * Math.PI);
        context.fill();
    }

    static drawGrid() {
        context.lineWidth = 1;
        context.strokeStyle = global.lineColor;
        context.fillStyle = '#4c4c4c';
        context.beginPath();


        for (var x = global.xoffset - global.player.x; x < global.screenWidth; x += global.screenHeight / 18) {
            context.moveTo(x, 0);
            context.lineTo(x, global.screenHeight);
        }

        for (var y = global.yoffset - global.player.y; y < global.screenHeight; y += global.screenHeight / 18) {
            context.moveTo(0, y);
            context.lineTo(global.screenWidth, y);
        }

        context.fill();
    }

    static drawBorder() {
        context.lineWidth = 1;
        context.strokeStyle = playerConfig.borderColor;

        // Left-vertical.
        if (global.player.x <= global.screenWidth / 2) {
            context.beginPath();
            context.moveTo(global.screenWidth / 2 - global.player.x, 0 ? global.player.y > global.screenHeight / 2 : global.screenHeight / 2 - global.player.y);
            context.lineTo(global.screenWidth / 2 - global.player.x, global.gameHeight + global.screenHeight / 2 - global.player.y);
            context.strokeStyle = global.lineColor;
            context.stroke();
        }

        // Top-horizontal.
        if (global.player.y <= global.screenHeight / 2) {
            context.beginPath();
            context.moveTo(0 ? global.player.x > global.screenWidth / 2 : global.screenWidth / 2 - global.player.x, global.screenHeight / 2 - global.player.y);
            context.lineTo(global.gameWidth + global.screenWidth / 2 - global.player.x, global.screenHeight / 2 - global.player.y);
            context.strokeStyle = global.lineColor;
            context.stroke();
        }

        // Right-vertical.
        if (global.gameWidth - global.player.x <= global.screenWidth / 2) {
            context.beginPath();
            context.moveTo(global.gameWidth + global.screenWidth / 2 - global.player.x,
                global.screenHeight / 2 - global.player.y);
            context.lineTo(global.gameWidth + global.screenWidth / 2 - global.player.x,
                global.gameHeight + global.screenHeight / 2 - global.player.y);
            context.strokeStyle = global.lineColor;
            context.stroke();
        }

        // Bottom-horizontal.
        if (global.gameHeight - global.player.y <= global.screenHeight / 2) {
            context.beginPath();
            context.moveTo(global.gameWidth + global.screenWidth / 2 - global.player.x,
                global.gameHeight + global.screenHeight / 2 - global.player.y);
            context.lineTo(global.screenWidth / 2 - global.player.x,
                global.gameHeight + global.screenHeight / 2 - global.player.y);
            context.strokeStyle = global.lineColor;
            context.stroke();
        }
    }

    static drawSpiderWeb(web) {

        var x = web.player.x - global.player.x + global.screenWidth / 2;
        var y = web.player.y - global.player.y + global.screenHeight / 2;

        var x1 = web.endPoint.x - global.player.x + global.screenWidth / 2;
        var y1 = web.endPoint.y - global.player.y + global.screenHeight / 2;


        context.lineWidth = 2;
        context.strokeStyle = "#333";

        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x1, y1);
        context.stroke();
        context.closePath();
    }

    static fixedX (x) {
        return x - global.player.x + global.screenWidth / 2;
    }

    static fixedY (y) {
        return y - global.player.y + global.screenHeight / 2;
    }

    static shootedWeb () {
        if (global.player.webAttach === null) return;
        context.lineWidth = 2;
        context.strokeStyle = "#333";
        context.fillStyle = '#333';

        context.beginPath();
        context.moveTo(Drawing.fixedX(global.player.x), Drawing.fixedY(global.player.y));
        context.lineTo(Drawing.fixedX(global.player.webAttach.x), Drawing.fixedY(global.player.webAttach.y));
        context.stroke();
        context.closePath();
    }

    static connectNode (arr) {
        arr.map((player)=>{
            let arr3 = _.chunk(player.nodes, 3);
            arr3.map((el)=>{
                var first = el[0];
                var second = el[1];
                var third = el[2];

                context.lineWidth = 2;
                context.strokeStyle = "#333";
                context.fillStyle = '#333';

                context.beginPath();
                context.moveTo(Drawing.fixedX(first.x), Drawing.fixedY(first.y));
                context.lineTo(Drawing.fixedX(second.x), Drawing.fixedY(second.y));
                context.lineTo(Drawing.fixedX(third.x), Drawing.fixedY(third.y));
                context.lineTo(Drawing.fixedX(first.x), Drawing.fixedY(first.y));
                context.stroke();
                context.closePath();
            });
        });

    }


    static drawNode(node) {
        if ( context === "undefined" ) {
            context = window.control.cv.getContext('2d');
        }

        context.strokeStyle = '#000';
        context.fillStyle = '#000';
        context.lineWidth = nodeConfig.border;
        Drawing.drawCircle(node.x, node.y, node.radius, global.nodeSides, true);
    }

    static drawSvg (order) {
        var size = 40;
        var img = new Image(size,size);
        img.src = "img/spider.png";


        for (var z = 0; z < order.length; z++) {
            var userCurrent = global.users[order[z].nCell];
            var cellCurrent = userCurrent.cells[order[z].nDiv];
            context.drawImage(img, (cellCurrent.x - (global.player.x - (global.screenWidth / 2))) - (size/2),
                (cellCurrent.y - (global.player.y - (global.screenHeight / 2))) - (size/2));
        }
    }

    static drawPlayers(order) {
        var start = {
            x: global.player.x - (global.screenWidth / 2),
            y: global.player.y - (global.screenHeight / 2)
        };

        for (var z = 0; z < order.length; z++) {
            var userCurrent = global.users[order[z].nCell];
            var cellCurrent = userCurrent.cells[order[z].nDiv];

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
                    x = valueInRange(-cellCurrent.x - global.player.x + global.screenWidth / 2 + (cellCurrent.radius / 3),
                        global.gameWidth - cellCurrent.x + global.gameWidth - global.player.x + global.screenWidth / 2 - (cellCurrent.radius / 3), x);
                    y = valueInRange(-cellCurrent.y - global.player.y + global.screenHeight / 2 + (cellCurrent.radius / 3),
                        global.gameHeight - cellCurrent.y + global.gameHeight - global.player.y + global.screenHeight / 2 - (cellCurrent.radius / 3), y);
                }
                global.spin += increase;
                xstore[i] = x;
                ystore[i] = y;
            }
            /*if (wiggle >= this.player.radius/ 3) inc = -1;
             *if (wiggle <= this.player.radius / -3) inc = +1;
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
                nameCell = global.player.name;
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
}

module.exports = Drawing;

