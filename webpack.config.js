module.exports = {
    entry: "./src/client/js/game.js",
    output: {
        path: require("path").resolve("./src/bin/client/js"),
        library: "game",
        filename: "game.js"
    },
    module: {
        loaders: [
            {
                test: /\.jsx?$/,
                exclude: /(node_modules|bower_components)/,
                loader: 'babel'
            }
        ]
    }
};
