export var IpcChannels;
(function (IpcChannels) {
    // System and Window
    IpcChannels["WINDOW_MINIMIZE"] = "window:minimize";
    IpcChannels["WINDOW_MAXIMIZE"] = "window:maximize";
    IpcChannels["WINDOW_CLOSE"] = "window:close";
    // Storage
    IpcChannels["STORAGE_SAVE_CONNECTION"] = "storage:saveConnection";
    IpcChannels["STORAGE_GET_CONNECTIONS"] = "storage:getConnections";
    IpcChannels["STORAGE_DELETE_CONNECTION"] = "storage:deleteConnection";
    // System Test
    IpcChannels["SYSTEM_PING"] = "system:ping";
})(IpcChannels || (IpcChannels = {}));
