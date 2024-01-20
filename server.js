const WebSocket = require("ws")
const express = require("express");
const http = require("http")

let PATH_CONFIG= {}

function forward_request(req, res, next) {
    console.log("receive request", req.url)
    if(req.url == "ws") {
        next()
    } else {
        let paths = req.url.split("/")
        let path = paths[1]
        let cfg = PATH_CONFIG[path]
        if(cfg) {
            cfg.conn.send(JSON.stringify({
                oper: "request", 
                path: path,
                data: {
                    body: req.body,
                    url: req.url,
                    method: req.method,
                    params: req.params,
                    query: req.query,
                },
                client: cfg.data
            }))
            cfg.res = res
        }
    }
}
function start_listen(port) {
    console.log("start listen on port", port)
    const app = express()
    app.use(express.static("static"))
    app.use(forward_request)
    const server = http.createServer(app)
    const ws = new WebSocket.Server({
        server: server,
        path: "/ws"
    })
    ws.on("connection", (conn) => {
        console.log("websocket new connection")
        conn.on("message", (str) => {
            try {
                let data = JSON.parse(str)
                console.log("receive msg", data.oper)
                if(data.oper == "register") {
                    let path = data.path
                    if(PATH_CONFIG[path]) {
                        conn.send(JSON.stringify({code: 101, error: "该路径已被注册"}))
                        return
                    }
                    PATH_CONFIG[path] = {
                        conn: conn,
                        data: data.data,
                    }
                    conn.send(JSON.stringify({code: 0, oper: data.oper, path: path}))
                } else if (data.oper == "response") {
                    let path = data.path
                    if(!PATH_CONFIG[path]) {
                        conn.send(JSON.stringify({code: 101, error: "该路径未注册"}))
                        return
                    }
                    let cfg = PATH_CONFIG[path]
                    cfg.res?.send(data.data)
                } else if (data.oper == "get_path_list") {
                    let paths = []
                    for(let path in PATH_CONFIG) {
                        let cfg = PATH_CONFIG[path]
                        if(cfg.conn == conn) {
                            paths.push({
                                path: path,
                                host: cfg.data.host
                            })
                        }
                    }
                    conn.send(JSON.stringify({code: 0, oper: data.oper, paths: paths}))
                } else if (data.oper == "unregister") {
                    let path = data.path
                    delete PATH_CONFIG[path]
                    conn.send(JSON.stringify({code: 0, oper: data.oper, path: path}))
                }
            } catch (error) {
                conn.send(JSON.stringify({code: -1, error: error.toString()}))
            }
        })
        conn.on("close", () => {
            for(let path in PATH_CONFIG) {
                if(PATH_CONFIG[path].conn == conn) {
                    console.log("unreigster path: ", path)
                    delete PATH_CONFIG[path]
                }
            }
        })
    })
    server.listen(port)
}
start_listen(process.argv[2] || 8080)