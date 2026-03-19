const path = require("path");
const fs = require("fs");
const webpack = require("webpack");
const {EsbuildPlugin} = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (env, argv) => {
    const isPro = argv.mode === "production";

    // Redirect hterm/libdot imports to bundler-compatible shims
    const resolveAlias = {
        [path.resolve(__dirname, "vendor/libapps/hterm/dist/js/hterm_resources.js")]:
            path.resolve(__dirname, "src/shims/hterm_resources.js"),
        [path.resolve(__dirname, "vendor/libapps/libdot/dist/js/libdot_resources.js")]:
            path.resolve(__dirname, "src/shims/libdot_resources.js"),
        [path.resolve(__dirname, "vendor/libapps/hterm/js/deps_punycode.rollup.js")]:
            path.resolve(__dirname, "vendor/libapps/hterm/js/deps_punycode.shim.js"),
    };

    // --- Main plugin bundle (CommonJS2 for SiYuan plugin loading) ---
    const mainPlugins = [
        new MiniCssExtractPlugin({
            filename: isPro ? "dist/index.css" : "index.css",
        }),
    ];

    if (isPro) {
        mainPlugins.push(new webpack.BannerPlugin({
            banner: () => {
                return fs.readFileSync("LICENSE").toString();
            },
        }));
        mainPlugins.push(new CopyPlugin({
            patterns: [
                {from: "preview.png", to: "./dist/"},
                {from: "icon.png", to: "./dist/"},
                {from: "README*.md", to: "./dist/"},
                {from: "plugin.json", to: "./dist/"},
                {from: "src/i18n/", to: "./dist/i18n/"},
                {from: "wasm/", to: "./dist/wasm/", noErrorOnMissing: true},
                // Include worker bundle (built by "worker" config via dependencies)
                {from: "dist/wassh-worker.js", to: "./dist/"},
            ],
        }));
        mainPlugins.push(new ZipPlugin({
            filename: "package.zip",
            algorithm: "gzip",
            include: [/dist/],
            pathMapper: (assetPath) => {
                return assetPath.replace("dist/", "");
            },
        }));
    } else {
        mainPlugins.push(new CopyPlugin({
            patterns: [
                {from: "src/i18n/", to: "./i18n/"},
                {from: "wasm/", to: "./wasm/", noErrorOnMissing: true},
            ],
        }));
    }

    const mainConfig = {
        name: "main",
        dependencies: isPro ? ["worker"] : [],
        mode: argv.mode || "development",
        watch: !isPro,
        devtool: isPro ? false : "eval",
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname),
            libraryTarget: "commonjs2",
            library: {
                type: "commonjs2",
            },
        },
        externals: {
            siyuan: "siyuan",
        },
        node: {
            __dirname: false,
            __filename: false,
        },
        entry: isPro
            ? {"dist/index": "./src/index.ts"}
            : {"index": "./src/index.ts"},
        optimization: {
            minimize: true,
            minimizer: [
                new EsbuildPlugin(),
            ],
        },
        resolve: {
            extensions: [".ts", ".scss", ".css", ".js", ".json"],
            alias: resolveAlias,
        },
        module: {
            rules: [
                {
                    test: /\.ts(x?)$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        {
                            loader: "esbuild-loader",
                            options: {
                                target: "es2020",
                            }
                        },
                    ],
                },
                {
                    test: /\.scss$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: "css-loader",
                        },
                        {
                            loader: "sass-loader",
                        },
                    ],
                },
                {
                    test: /\.css$/,
                    use: [
                        MiniCssExtractPlugin.loader,
                        {
                            loader: "css-loader",
                        },
                    ],
                },
                // Force JSON type for vendor .json imports (overrides "type": "module" in package.json)
                {
                    test: /\.json$/,
                    include: [path.resolve(__dirname, "vendor")],
                    type: "json",
                },
                // Asset loaders for hterm/libdot resources
                {
                    test: /\.ogg$/,
                    include: [path.resolve(__dirname, "vendor")],
                    type: "asset/inline",
                },
                {
                    test: /\.svg$/,
                    include: [path.resolve(__dirname, "vendor")],
                    type: "asset/inline",
                },
                {
                    test: /\.png$/,
                    include: [path.resolve(__dirname, "vendor")],
                    type: "asset/inline",
                },
                {
                    test: /\.html$/,
                    include: [path.resolve(__dirname, "vendor")],
                    type: "asset/source",
                },
            ],
        },
        plugins: mainPlugins,
    };

    // --- Worker bundle (ESM for Web Worker with {type: "module"}) ---
    const workerConfig = {
        name: "worker",
        mode: argv.mode || "development",
        watch: !isPro,
        devtool: isPro ? false : "eval",
        entry: isPro
            ? {"dist/wassh-worker": "./vendor/libapps/wassh/js/worker.js"}
            : {"wassh-worker": "./vendor/libapps/wassh/js/worker.js"},
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname),
            module: true,
        },
        experiments: {
            outputModule: true,
        },
        resolve: {
            extensions: [".js", ".json"],
        },
        optimization: {
            minimize: isPro,
            minimizer: [
                new EsbuildPlugin(),
            ],
        },
    };

    return [workerConfig, mainConfig];
};
