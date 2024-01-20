
let protol = (location.protocol == "http:") ? "ws://" : "wss://"
let ws = null
function connect_ws() {
    add_log("开始连接服务器")
    ws = new WebSocket(`${protol}${location.host}/ws`)
    ws.onmessage = (event) => {
        let data = JSON.parse(event.data)
        if (data.code && data.code != 0) {
            alert(data.error)
            return
        }
        if (data.oper == "request") {
            add_log(`转发外网请求${data.data.url}`)
            on_receive_request(data)
        } else if (data.oper == "get_path_list") {
            on_receive_path_list(data)
        } else if (data.oper == "register") {
            add_log(`注册${data.path}成功`)
            get_path_list()
        } else if (data.oper == "unregister") {
            add_log(`删除${data.path}成功`)
            get_path_list()
        }
    }
    ws.onclose = () => {
        add_log("服务器断开连接")
        on_receive_path_list({path: []})
        connect_ws()
    }
    ws.onopen = () => {
        add_log("连接服务器成功")
        get_path_list()
    }
}
function on_receive_request(data) {
    let client_data = data.client
    let request_data = data.data
    let host = client_data.host
    if(!host.endsWith("/")) host += "/"
    let query_url = request_data.url.replace("/" + data.path + "/", "")
    let url = `${host}${query_url}`
    let xhr = new XMLHttpRequest()
    xhr.open(request_data.method, url)
    xhr.onreadystatechange = (ev) => {                    
        if (xhr.readyState == 4) {
            if ((xhr.status >= 200 && xhr.status < 400)) {
                ws.send(JSON.stringify({
                    oper: "response",
                    path: data.path,
                    data: xhr.responseText
                }))
                add_log(`返回内网${host}响应`)
            }
        }
    }
    xhr.send(request_data.body)
}
function on_receive_path_list(data) {
    let path_table = document.getElementById("path_list")
    let children = path_table.rows
    for(let i = children.length - 1; i > 0;i--) {
        children[i].remove()
    }
    let path_list = data.paths
    add_log(`刷新路径列表，共${path_list.length}个`)
    for(let i = 0, len = path_list.length; i < len; i++) {
        let item_data = path_list[i]
        let child = path_table.insertRow()
        let path_ele = document.createElement("td")
        path_ele.innerHTML = `<a target="_blank" href="./${item_data.path}">${item_data.path}</a>`
        child.appendChild(path_ele)
        let host_ele = document.createElement("td")
        host_ele.innerText = item_data.host
        child.appendChild(host_ele)
        let unregister_ele = document.createElement("td")
        unregister_ele.innerHTML = `<button onclick="unregister_path('${item_data.path}')">删除</button>`
        child.appendChild(unregister_ele)
    }
}
function register_path() {
    let path = document.getElementById("path").value
    let host = document.getElementById("host").value
    ws.send(JSON.stringify({
        oper: "register",
        path: path,
        data: { host }
    }))
}
function unregister_path(path) {
    ws.send(JSON.stringify({
        oper: "unregister",
        path: path,
    }))
}
function get_path_list() {
    ws.send(JSON.stringify({
        oper: "get_path_list",
    }))
}
function add_log(log_text) {
    let logs = document.getElementById("logs")
    let li = document.createElement("li")
    let time_str = new Date().toLocaleString()
    li.innerText = time_str + "  " + log_text
    if(logs.firstChild) {
        logs.insertBefore(li, logs.firstChild)
    } else {
        logs.appendChild(li)
    }
}
window.onload = () => {
    connect_ws()
}