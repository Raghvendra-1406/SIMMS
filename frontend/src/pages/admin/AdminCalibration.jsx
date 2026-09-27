import { useEffect, useRef, useState } from "react";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
}

function navigateTo(path) {
  window.location.href = path;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function NavigationItem({
  icon,
  label,
  path,
  active,
  collapsed,
}) {
  return (
    <button
      type="button"
      onClick={() => navigateTo(path)}
      title={collapsed ? label : undefined}
      className={`group flex w-full items-center rounded-xl text-left text-sm font-semibold transition ${
        collapsed
          ? "justify-center px-2 py-2.5"
          : "gap-3 px-3 py-2.5"
      } ${
        active
          ? "bg-cyan-500 text-white shadow-md shadow-cyan-500/20"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
          active
            ? "bg-white/15 text-white"
            : "bg-white/5 text-slate-400 group-hover:text-cyan-300"
        }`}
      >
        {icon}
      </span>

      {!collapsed && (
        <span className="truncate">
          {label}
        </span>
      )}
    </button>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}) {
  return (
    <div>
      {eyebrow && (
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-600">
          {eyebrow}
        </p>
      )}

      <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
        {title}
      </h2>

      {description && (
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    ACTIVE:
      "bg-emerald-50 text-emerald-700 border-emerald-100",
    INACTIVE:
      "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${
        styles[status] ||
        "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {status || "—"}
    </span>
  );
}

export default function AdminCalibration() {
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);

  const [classrooms, setClassrooms] = useState([]);
  const [devices, setDevices] = useState([]);

  const [selectedRoomId, setSelectedRoomId] =
    useState("");

  const [selectedDeviceId, setSelectedDeviceId] =
    useState("");

  const [imageFile, setImageFile] =
    useState(null);

  const [imageUrl, setImageUrl] =
    useState("");

  const [savedImagePath, setSavedImagePath] =
    useState("");

  const [fanBoxes, setFanBoxes] =
    useState([]);

  const [activeCalibration, setActiveCalibration] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [loadingCalibration, setLoadingCalibration] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [isDrawing, setIsDrawing] =
    useState(false);

  const [drawStart, setDrawStart] =
    useState(null);

  const [currentBox, setCurrentBox] =
    useState(null);

  const imageRef = useRef(null);
  const canvasRef = useRef(null);

  const adminName =
    localStorage.getItem("name") ||
    "Administrator";

  /*
   * ---------------------------------------------------------
   * LOAD CLASSROOMS
   * ---------------------------------------------------------
   */

  const loadClassrooms = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/classrooms`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load classrooms."
        );
      }

      const data = await response.json();

      setClassrooms(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load classrooms."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * LOAD DEVICES
   * ---------------------------------------------------------
   */

  const loadDevices = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/devices`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load devices."
        );
      }

      const data = await response.json();

      setDevices(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load devices."
      );
    }
  };

  useEffect(() => {
    loadClassrooms();
    loadDevices();
  }, []);

  /*
   * ---------------------------------------------------------
   * FAN DEVICES FOR SELECTED CLASSROOM
   * ---------------------------------------------------------
   */

  const roomDevices = devices.filter(
    (device) =>
      String(device.room_id) ===
        String(selectedRoomId) &&
      device.status === "ACTIVE"
  );

  const fanDevices = roomDevices.filter(
    (device) =>
      device.device_type?.toUpperCase() ===
        "FAN"
  );

  /*
   * ---------------------------------------------------------
   * LOAD ACTIVE CALIBRATION
   * ---------------------------------------------------------
   */

  const loadActiveCalibration = async (
    roomId
  ) => {
    if (!roomId) {
      return;
    }

    try {
      setLoadingCalibration(true);
      setError("");
      setSuccess("");

      const response = await fetch(
        `${API_BASE_URL}/vision/calibration/room/${roomId}/active`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.status === 404) {
        setActiveCalibration(null);
        setFanBoxes([]);
        setSavedImagePath("");
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Unable to load active calibration."
        );
      }

      const result =
        await response.json();

      const calibration =
        result.data;

      setActiveCalibration(calibration);

      /*
       * Existing calibration image
       *
       * If backend returns a URL/path that the
       * browser can access, show it.
       */
      if (calibration?.image_path) {
        setSavedImagePath(
          calibration.image_path
        );

        setImageUrl(
          calibration.image_path.startsWith(
            "http"
          )
            ? calibration.image_path
            : `${API_BASE_URL}/${calibration.image_path.replace(
                /^\/+/,
                ""
              )}`
        );
      }

      const savedFans =
        calibration?.calibration_data
          ?.fans || [];

      setFanBoxes(
        Array.isArray(savedFans)
          ? savedFans
          : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load calibration."
      );
    } finally {
      setLoadingCalibration(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * CLASSROOM CHANGE
   * ---------------------------------------------------------
   */

  const handleRoomChange = async (
    event
  ) => {
    const roomId =
      event.target.value;

    setSelectedRoomId(roomId);
    setSelectedDeviceId("");

    setImageFile(null);
    setImageUrl("");
    setSavedImagePath("");

    setFanBoxes([]);
    setCurrentBox(null);
    setActiveCalibration(null);

    setSuccess("");
    setError("");

    if (roomId) {
      await loadActiveCalibration(
        roomId
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * IMAGE UPLOAD
   * ---------------------------------------------------------
   */

  const handleImageUpload = (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError(
        "Please upload a valid image file."
      );
      return;
    }

    setImageFile(file);

    const localUrl =
      URL.createObjectURL(file);

    setImageUrl(localUrl);

    /*
     * New image means we are preparing
     * a new calibration.
     */
    setFanBoxes([]);
    setCurrentBox(null);
    setActiveCalibration(null);
    setSavedImagePath("");

    setError("");
    setSuccess("");
  };

  /*
   * ---------------------------------------------------------
   * GET CANVAS COORDINATES
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   * Coordinates are stored relative to the
   * ORIGINAL IMAGE dimensions.
   *
   * This means browser resizing does not
   * break Raspberry Pi calibration.
   */

  const getImageCoordinates = (
    event
  ) => {
    const image =
      imageRef.current;

    if (!image) {
      return null;
    }

    const rect =
      image.getBoundingClientRect();

    const naturalWidth =
      image.naturalWidth;

    const naturalHeight =
      image.naturalHeight;

    if (
      !naturalWidth ||
      !naturalHeight
    ) {
      return null;
    }

    const scaleX =
      naturalWidth / rect.width;

    const scaleY =
      naturalHeight / rect.height;

    let x =
      (event.clientX -
        rect.left) *
      scaleX;

    let y =
      (event.clientY -
        rect.top) *
      scaleY;

    x = Math.max(
      0,
      Math.min(x, naturalWidth)
    );

    y = Math.max(
      0,
      Math.min(y, naturalHeight)
    );

    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  };

  /*
   * ---------------------------------------------------------
   * START DRAWING
   * ---------------------------------------------------------
   */

  const handleMouseDown = (
    event
  ) => {
    if (!imageRef.current) {
      return;
    }

    if (!selectedDeviceId) {
      setError(
        "Select a fan device before drawing its area."
      );
      return;
    }

    const point =
      getImageCoordinates(event);

    if (!point) {
      return;
    }

    setError("");
    setSuccess("");

    setIsDrawing(true);

    setDrawStart(point);

    /*
     * This makes the rectangle
     * appear immediately.
     */
    setCurrentBox({
      device_id:
        Number(selectedDeviceId),
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
    });
  };

  /*
   * ---------------------------------------------------------
   * LIVE DRAWING
   * ---------------------------------------------------------
   */

  const handleMouseMove = (
    event
  ) => {
    if (
      !isDrawing ||
      !drawStart
    ) {
      return;
    }

    const point =
      getImageCoordinates(event);

    if (!point) {
      return;
    }

    /*
     * IMPORTANT:
     *
     * currentBox is updated on EVERY
     * mouse movement.
     *
     * Therefore the rectangle is LIVE.
     */

    setCurrentBox({
      device_id:
        Number(selectedDeviceId),

      x1: Math.min(
        drawStart.x,
        point.x
      ),

      y1: Math.min(
        drawStart.y,
        point.y
      ),

      x2: Math.max(
        drawStart.x,
        point.x
      ),

      y2: Math.max(
        drawStart.y,
        point.y
      ),
    });
  };

  /*
   * ---------------------------------------------------------
   * FINISH DRAWING
   * ---------------------------------------------------------
   */

  const handleMouseUp = (
    event
  ) => {
    if (
      !isDrawing ||
      !drawStart
    ) {
      return;
    }

    const point =
      getImageCoordinates(event);

    setIsDrawing(false);
    setDrawStart(null);

    if (!point) {
      setCurrentBox(null);
      return;
    }

    const finalBox = {
      device_id:
        Number(selectedDeviceId),

      x1: Math.min(
        drawStart.x,
        point.x
      ),

      y1: Math.min(
        drawStart.y,
        point.y
      ),

      x2: Math.max(
        drawStart.x,
        point.x
      ),

      y2: Math.max(
        drawStart.y,
        point.y
      ),
    };

    /*
     * Ignore tiny accidental clicks.
     */
    if (
      Math.abs(
        finalBox.x2 -
          finalBox.x1
      ) < 10 ||
      Math.abs(
        finalBox.y2 -
          finalBox.y1
      ) < 10
    ) {
      setCurrentBox(null);
      setError(
        "Please draw a larger fan area."
      );
      return;
    }

    /*
     * Replace an existing box for the
     * same fan device.
     */
    setFanBoxes((previous) => [
      ...previous.filter(
        (box) =>
          Number(box.device_id) !==
          Number(finalBox.device_id)
      ),
      finalBox,
    ]);

    setCurrentBox(null);

    setSuccess(
      "Fan area selected. You can draw another fan area or save the calibration."
    );
  };

  /*
   * ---------------------------------------------------------
   * MOUSE LEAVES IMAGE
   * ---------------------------------------------------------
   */

  const handleMouseLeave = () => {
    /*
     * Do NOT cancel the box immediately.
     *
     * Keeping the current box visible makes
     * drawing feel much more stable.
     */
  };

  /*
   * ---------------------------------------------------------
   * TOUCH SUPPORT
   * ---------------------------------------------------------
   */

  const getTouchPoint = (
    touch
  ) => {
    const image =
      imageRef.current;

    if (!image) {
      return null;
    }

    const rect =
      image.getBoundingClientRect();

    const naturalWidth =
      image.naturalWidth;

    const naturalHeight =
      image.naturalHeight;

    const scaleX =
      naturalWidth / rect.width;

    const scaleY =
      naturalHeight / rect.height;

    let x =
      (touch.clientX -
        rect.left) *
      scaleX;

    let y =
      (touch.clientY -
        rect.top) *
      scaleY;

    x = Math.max(
      0,
      Math.min(x, naturalWidth)
    );

    y = Math.max(
      0,
      Math.min(y, naturalHeight)
    );

    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  };

  const handleTouchStart = (
    event
  ) => {
    if (!selectedDeviceId) {
      setError(
        "Select a fan device before drawing its area."
      );
      return;
    }

    event.preventDefault();

    const point =
      getTouchPoint(
        event.touches[0]
      );

    if (!point) {
      return;
    }

    setIsDrawing(true);
    setDrawStart(point);

    setCurrentBox({
      device_id:
        Number(selectedDeviceId),
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y,
    });
  };

  const handleTouchMove = (
    event
  ) => {
    if (
      !isDrawing ||
      !drawStart
    ) {
      return;
    }

    event.preventDefault();

    const point =
      getTouchPoint(
        event.touches[0]
      );

    if (!point) {
      return;
    }

    setCurrentBox({
      device_id:
        Number(selectedDeviceId),

      x1: Math.min(
        drawStart.x,
        point.x
      ),

      y1: Math.min(
        drawStart.y,
        point.y
      ),

      x2: Math.max(
        drawStart.x,
        point.x
      ),

      y2: Math.max(
        drawStart.y,
        point.y
      ),
    });
  };

  const handleTouchEnd = () => {
    if (
      !isDrawing ||
      !drawStart ||
      !currentBox
    ) {
      return;
    }

    setIsDrawing(false);
    setDrawStart(null);

    if (
      Math.abs(
        currentBox.x2 -
          currentBox.x1
      ) < 10 ||
      Math.abs(
        currentBox.y2 -
          currentBox.y1
      ) < 10
    ) {
      setCurrentBox(null);
      return;
    }

    setFanBoxes((previous) => [
      ...previous.filter(
        (box) =>
          Number(box.device_id) !==
          Number(
            currentBox.device_id
          )
      ),
      currentBox,
    ]);

    setCurrentBox(null);

    setSuccess(
      "Fan area selected."
    );
  };

  /*
   * ---------------------------------------------------------
   * DELETE FAN BOX
   * ---------------------------------------------------------
   */

  const removeFanBox = (
    deviceId
  ) => {
    setFanBoxes((previous) =>
      previous.filter(
        (box) =>
          Number(box.device_id) !==
          Number(deviceId)
      )
    );
  };

  /*
   * ---------------------------------------------------------
   * DEVICE NAME
   * ---------------------------------------------------------
   */

  const getDeviceName = (
    deviceId
  ) => {
    const device =
      devices.find(
        (item) =>
          Number(item.device_id) ===
          Number(deviceId)
      );

    return (
      device?.device_name ||
      `Fan ${deviceId}`
    );
  };

  /*
   * ---------------------------------------------------------
   * CONVERT ORIGINAL IMAGE COORDINATES
   * TO DISPLAY COORDINATES
   * ---------------------------------------------------------
   */

  const getDisplayBoxStyle = (
    box
  ) => {
    const image =
      imageRef.current;

    if (!image) {
      return {};
    }

    const naturalWidth =
      image.naturalWidth;

    const naturalHeight =
      image.naturalHeight;

    if (
      !naturalWidth ||
      !naturalHeight
    ) {
      return {};
    }

    const left =
      (box.x1 / naturalWidth) *
      100;

    const top =
      (box.y1 / naturalHeight) *
      100;

    const width =
      ((box.x2 - box.x1) /
        naturalWidth) *
      100;

    const height =
      ((box.y2 - box.y1) /
        naturalHeight) *
      100;

    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
    };
  };

  /*
   * ---------------------------------------------------------
   * SAVE CALIBRATION
   * ---------------------------------------------------------
   */

  const saveCalibration = async () => {
    if (!selectedRoomId) {
      setError(
        "Please select a classroom."
      );
      return;
    }

    if (!imageFile && !savedImagePath) {
      setError(
        "Please upload a classroom image."
      );
      return;
    }

    if (fanBoxes.length === 0) {
      setError(
        "Please draw at least one fan area."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      /*
       * IMPORTANT:
       *
       * Your current backend accepts image_path
       * as a string, not multipart upload.
       *
       * Therefore this frontend sends the selected
       * image filename/path for now.
       *
       * The image itself is shown locally in the
       * browser while calibration is being created.
       */

      const imagePath =
        savedImagePath ||
        imageFile?.name ||
        "uploaded-classroom-image";

      const payload = {
        room_id:
          Number(selectedRoomId),

        image_path:
          imagePath,

        fans: fanBoxes.map(
          (box) => ({
            device_id:
              Number(box.device_id),

            x1: Number(box.x1),
            y1: Number(box.y1),
            x2: Number(box.x2),
            y2: Number(box.y2),
          })
        ),
      };

      const response =
        await fetch(
          `${API_BASE_URL}/vision/calibration`,
          {
            method: "POST",

            headers: {
              ...getAuthHeaders(),
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              payload
            ),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail ||
            "Unable to save calibration."
        );
      }

      setSuccess(
        "Vision calibration saved successfully."
      );

      /*
       * Reload the saved calibration so
       * the page immediately reflects the
       * backend data.
       */
      await loadActiveCalibration(
        selectedRoomId
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to save calibration."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * LOGOUT
   * ---------------------------------------------------------
   */

  const handleLogout = () => {
    localStorage.removeItem(
      "access_token"
    );

    localStorage.removeItem(
      "user_id"
    );

    localStorage.removeItem(
      "name"
    );

    localStorage.removeItem(
      "email"
    );

    localStorage.removeItem(
      "role"
    );

    localStorage.removeItem(
      "is_active"
    );

    window.location.href = "/";
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">

      {/* ================================================= */}
      {/* SIDEBAR */}
      {/* ================================================= */}

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-slate-950 transition-all duration-300 lg:flex ${
          sidebarCollapsed
            ? "w-[76px]"
            : "w-64"
        }`}
      >

        {/* BRAND */}

        <div
          className={`flex h-20 items-center border-b border-white/10 ${
            sidebarCollapsed
              ? "justify-center px-3"
              : "justify-between px-5"
          }`}
        >

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-lg font-black text-slate-950 shadow-lg shadow-cyan-400/20">
              S
            </div>

            {!sidebarCollapsed && (
              <div>
                <p className="font-black tracking-[0.2em] text-white">
                  SIMMS
                </p>

                <p className="text-[9px] uppercase tracking-[0.13em] text-slate-500">
                  Admin Console
                </p>
              </div>
            )}

          </div>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() =>
                setSidebarCollapsed(true)
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white"
              title="Collapse sidebar"
            >
              ‹
            </button>
          )}

          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() =>
                setSidebarCollapsed(false)
              }
              title="Expand sidebar"
              className="absolute -right-3 top-6 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-bold text-cyan-300 shadow-lg"
            >
              ›
            </button>
          )}

        </div>

        {/* NAVIGATION */}

        <div className="hide-scrollbar flex-1 overflow-y-auto px-3 py-7">

          {!sidebarCollapsed && (
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Main
            </p>
          )}

          <nav className="space-y-1">

            <NavigationItem
              icon="▦"
              label="Dashboard"
              path="/admin/dashboard"
              collapsed={
                sidebarCollapsed
              }
            />

            <NavigationItem
              icon="▣"
              label="Classrooms"
              path="/admin/rooms"
              collapsed={
                sidebarCollapsed
              }
            />

            <NavigationItem
              icon="⌁"
              label="Devices"
              path="/admin/devices"
              collapsed={
                sidebarCollapsed
              }
            />

            <NavigationItem
              icon="◉"
              label="Users"
              path="/admin/users"
              collapsed={
                sidebarCollapsed
              }
            />

          </nav>

          {!sidebarCollapsed && (
            <p className="mb-3 mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Management
            </p>
          )}

          <nav className="space-y-1">

            <NavigationItem
              icon="⌘"
              label="Calibration"
              path="/admin/calibration"
              active
              collapsed={
                sidebarCollapsed
              }
            />

          </nav>

          {!sidebarCollapsed && (
            <div className="mt-8 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4">

              <div className="flex items-center gap-2">

                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                <span className="text-xs font-semibold text-slate-300">
                  Monitoring active
                </span>

              </div>

              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                SIMMS classroom infrastructure
                monitoring is connected.
              </p>

            </div>
          )}

        </div>

        {/* FOOTER */}

        <div className="border-t border-white/10 p-3">

          {!sidebarCollapsed && (
            <div className="mb-3 rounded-xl bg-white/5 p-3">

              <p className="truncate text-xs font-semibold text-white">
                {adminName}
              </p>

              <p className="mt-1 text-[10px] text-slate-500">
                Administrator
              </p>

            </div>
          )}

          <button
            type="button"
            onClick={handleLogout}
            title={
              sidebarCollapsed
                ? "Logout"
                : undefined
            }
            className={`flex w-full items-center rounded-xl text-sm font-semibold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300 ${
              sidebarCollapsed
                ? "justify-center px-2 py-2.5"
                : "gap-3 px-3 py-2.5"
            }`}
          >

            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
              ↪
            </span>

            {!sidebarCollapsed && (
              <span>Logout</span>
            )}

          </button>

        </div>

      </aside>

      {/* ================================================= */}
      {/* MAIN */}
      {/* ================================================= */}

      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed
            ? "lg:pl-[76px]"
            : "lg:pl-64"
        }`}
      >

        {/* TOP BAR */}

        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">

          <div className="flex h-20 items-center justify-between px-5 sm:px-8">

            <div>

              <p className="text-xs font-semibold text-slate-400">
                Administration
              </p>

              <h1 className="text-lg font-bold text-slate-900">
                Vision Calibration
              </h1>

            </div>

            <div className="flex items-center gap-3">

              <div className="hidden items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 sm:flex">

                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-xs font-semibold text-emerald-700">
                  System connected
                </span>

              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-sm font-bold text-cyan-700">
                {adminName
                  .charAt(0)
                  .toUpperCase()}
              </div>

            </div>

          </div>

        </header>

        {/* ================================================= */}
        {/* CONTENT */}
        {/* ================================================= */}

        <main className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8">

          {/* HEADER */}

          <section className="mb-6 overflow-hidden rounded-3xl bg-slate-950 p-7 shadow-xl sm:p-9">

            <div className="relative z-10">

              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5">

                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />

                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-300">
                  Camera configuration
                </span>

              </div>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Fan Vision Calibration
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Select a classroom, upload its camera
                image, and draw the fan areas directly
                on the image. The coordinates are stored
                for the SIMMS vision runtime.
              </p>

            </div>

          </section>

          {/* ERROR */}

          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">

              <p className="text-sm font-bold text-red-800">
                Calibration error
              </p>

              <p className="mt-1 text-xs text-red-600">
                {error}
              </p>

            </div>
          )}

          {/* SUCCESS */}

          {success && (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

              <p className="text-sm font-bold text-emerald-800">
                Calibration updated
              </p>

              <p className="mt-1 text-xs text-emerald-600">
                {success}
              </p>

            </div>
          )}

          <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">

            {/* ================================================= */}
            {/* LEFT CONTROL PANEL */}
            {/* ================================================= */}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <SectionTitle
                eyebrow="Configuration"
                title="Calibration setup"
                description="Choose the classroom and fan devices to calibrate."
              />

              {/* ROOM */}

              <div className="mt-6">

                <label className="mb-2 block text-xs font-bold text-slate-600">
                  Classroom
                </label>

                <select
                  value={selectedRoomId}
                  onChange={handleRoomChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50"
                >

                  <option value="">
                    Select classroom
                  </option>

                  {classrooms.map(
                    (room) => (
                      <option
                        key={
                          room.room_id
                        }
                        value={
                          room.room_id
                        }
                      >
                        {room.room_name ||
                          `Room ${room.room_id}`}
                      </option>
                    )
                  )}

                </select>

              </div>

              {/* IMAGE */}

              <div className="mt-5">

                <label className="mb-2 block text-xs font-bold text-slate-600">
                  Classroom image
                </label>

                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center transition hover:border-cyan-300 hover:bg-cyan-50/40">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg shadow-sm">
                    ↑
                  </div>

                  <p className="mt-3 text-xs font-bold text-slate-700">
                    Upload camera image
                  </p>

                  <p className="mt-1 text-[10px] text-slate-400">
                    PNG, JPG or JPEG
                  </p>

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={
                      handleImageUpload
                    }
                    className="hidden"
                  />

                </label>

                {imageFile && (
                  <p className="mt-2 truncate text-[10px] text-slate-400">
                    {imageFile.name}
                  </p>
                )}

              </div>

              {/* FAN DEVICE */}

              <div className="mt-5">

                <label className="mb-2 block text-xs font-bold text-slate-600">
                  Fan device
                </label>

                <select
                  value={selectedDeviceId}
                  onChange={(event) =>
                    setSelectedDeviceId(
                      event.target.value
                    )
                  }
                  disabled={
                    !selectedRoomId
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50 disabled:bg-slate-50 disabled:text-slate-400"
                >

                  <option value="">
                    Select fan
                  </option>

                  {fanDevices.map(
                    (device) => (
                      <option
                        key={
                          device.device_id
                        }
                        value={
                          device.device_id
                        }
                      >
                        {device.device_name}
                      </option>
                    )
                  )}

                </select>

                {selectedRoomId &&
                  fanDevices.length ===
                    0 && (
                    <p className="mt-2 text-[10px] text-amber-600">
                      No active fan devices are
                      registered for this classroom.
                    </p>
                  )}

              </div>

              {/* INSTRUCTIONS */}

              <div className="mt-6 rounded-xl border border-cyan-100 bg-cyan-50 p-4">

                <p className="text-xs font-bold text-cyan-800">
                  How to calibrate
                </p>

                <ol className="mt-2 space-y-2 text-[11px] leading-5 text-cyan-700">

                  <li>
                    1. Select a classroom.
                  </li>

                  <li>
                    2. Upload the camera image.
                  </li>

                  <li>
                    3. Select a fan device.
                  </li>

                  <li>
                    4. Click and drag over the fan.
                  </li>

                  <li>
                    5. The rectangle appears live while
                    you drag.
                  </li>

                  <li>
                    6. Save the calibration.
                  </li>

                </ol>

              </div>

              {/* CURRENT BOXES */}

              <div className="mt-6">

                <div className="mb-3 flex items-center justify-between">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Fan areas
                  </p>

                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                    {fanBoxes.length}
                  </span>

                </div>

                <div className="space-y-2">

                  {fanBoxes.length ===
                    0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center">

                      <p className="text-xs font-semibold text-slate-500">
                        No fan areas drawn
                      </p>

                    </div>
                  ) : (
                    fanBoxes.map(
                      (box) => (
                        <div
                          key={
                            box.device_id
                          }
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
                        >

                          <div>

                            <p className="text-xs font-bold text-slate-700">
                              {getDeviceName(
                                box.device_id
                              )}
                            </p>

                            <p className="mt-1 text-[9px] text-slate-400">
                              ({box.x1},{" "}
                              {box.y1}) → (
                              {box.x2},{" "}
                              {box.y2})
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeFanBox(
                                box.device_id
                              )
                            }
                            className="rounded-lg px-2 py-1.5 text-[10px] font-bold text-red-500 hover:bg-red-50"
                          >
                            Remove
                          </button>

                        </div>
                      )
                    )
                  )}

                </div>

              </div>

              {/* SAVE */}

              <button
                type="button"
                onClick={
                  saveCalibration
                }
                disabled={
                  saving ||
                  !selectedRoomId ||
                  fanBoxes.length ===
                    0
                }
                className="mt-6 w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving calibration..."
                  : "Save calibration"}
              </button>

            </div>

            {/* ================================================= */}
            {/* RIGHT IMAGE AREA */}
            {/* ================================================= */}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                <SectionTitle
                  eyebrow="Interactive canvas"
                  title="Fan detection areas"
                  description="Draw rectangles directly over the fans."
                />

                {loadingCalibration && (
                  <span className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-bold text-slate-500">
                    Loading calibration...
                  </span>
                )}

              </div>

              {!imageUrl ? (
                <div className="flex min-h-[560px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">

                  <div className="max-w-sm text-center">

                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                      ▧
                    </div>

                    <p className="mt-5 text-sm font-bold text-slate-700">
                      No classroom image selected
                    </p>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Select a classroom and upload its
                      camera image to begin fan calibration.
                    </p>

                  </div>

                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-950 p-3">

                  {/* IMAGE CANVAS */}

                  <div
                    className="relative mx-auto w-full max-w-[1100px] select-none overflow-hidden rounded-xl"
                    onMouseDown={
                      handleMouseDown
                    }
                    onMouseMove={
                      handleMouseMove
                    }
                    onMouseUp={
                      handleMouseUp
                    }
                    onMouseLeave={
                      handleMouseLeave
                    }
                    onTouchStart={
                      handleTouchStart
                    }
                    onTouchMove={
                      handleTouchMove
                    }
                    onTouchEnd={
                      handleTouchEnd
                    }
                    style={{
                      cursor:
                        selectedDeviceId
                          ? "crosshair"
                          : "default",
                      touchAction:
                        "none",
                    }}
                  >

                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="Classroom calibration"
                      draggable={false}
                      className="block h-auto w-full"
                      onLoad={() =>
                        setCurrentBox(
                          null
                        )
                      }
                    />

                    {/* SAVED FAN BOXES */}

                    {fanBoxes.map(
                      (box) => (
                        <div
                          key={
                            `saved-${box.device_id}`
                          }
                          className="pointer-events-none absolute border-2 border-cyan-400 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                          style={getDisplayBoxStyle(
                            box
                          )}
                        >

                          <div className="absolute -top-7 left-0 whitespace-nowrap rounded-md bg-cyan-500 px-2 py-1 text-[9px] font-bold text-white shadow-md">
                            {getDeviceName(
                              box.device_id
                            )}
                          </div>

                        </div>
                      )
                    )}

                    {/* LIVE DRAWING BOX */}

                    {currentBox && (
                      <div
                        className="pointer-events-none absolute border-2 border-amber-400 bg-amber-400/20"
                        style={getDisplayBoxStyle(
                          currentBox
                        )}
                      >

                        <div className="absolute -top-7 left-0 whitespace-nowrap rounded-md bg-amber-500 px-2 py-1 text-[9px] font-bold text-white shadow-md">
                          {getDeviceName(
                            currentBox.device_id
                          )}{" "}
                          · drawing
                        </div>

                      </div>
                    )}

                  </div>

                </div>
              )}

              {/* CANVAS STATUS */}

              {imageUrl && (
                <div className="mt-5 grid gap-3 sm:grid-cols-3">

                  <div className="rounded-xl bg-slate-50 p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Fans calibrated
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-800">
                      {fanBoxes.length}
                    </p>

                  </div>

                  <div className="rounded-xl bg-cyan-50 p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-600">
                      Canvas mode
                    </p>

                    <p className="mt-1 text-sm font-black text-cyan-700">
                      {selectedDeviceId
                        ? "Ready to draw"
                        : "Select fan"}
                    </p>

                  </div>

                  <div className="rounded-xl bg-emerald-50 p-4">

                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                      Calibration
                    </p>

                    <p className="mt-1 text-sm font-black text-emerald-700">
                      {activeCalibration
                        ? `v${activeCalibration.calibration_version}`
                        : "New"}
                    </p>

                  </div>

                </div>
              )}

              {/* COORDINATE INFO */}

              {currentBox && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">

                  <p className="text-xs font-bold text-amber-800">
                    Drawing fan area
                  </p>

                  <p className="mt-1 text-[11px] text-amber-700">
                    X: {currentBox.x1} →{" "}
                    {currentBox.x2}
                    {" · "}
                    Y: {currentBox.y1} →{" "}
                    {currentBox.y2}
                  </p>

                </div>
              )}

            </div>

          </section>

          {/* ================================================= */}
          {/* ACTIVE CALIBRATION */}
          {/* ================================================= */}

          {activeCalibration && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                <SectionTitle
                  eyebrow="Backend record"
                  title="Active calibration"
                  description="This calibration is currently active for the selected classroom."
                />

                <StatusBadge status="ACTIVE" />

              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-4">

                <div className="rounded-xl bg-slate-50 p-4">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Version
                  </p>

                  <p className="mt-1 text-lg font-black text-slate-800">
                    v
                    {
                      activeCalibration.calibration_version
                    }
                  </p>

                </div>

                <div className="rounded-xl bg-slate-50 p-4">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Room
                  </p>

                  <p className="mt-1 text-lg font-black text-slate-800">
                    {
                      activeCalibration.room_id
                    }
                  </p>

                </div>

                <div className="rounded-xl bg-slate-50 p-4">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Fan areas
                  </p>

                  <p className="mt-1 text-lg font-black text-slate-800">
                    {
                      activeCalibration
                        .calibration_data
                        ?.fans?.length ||
                      0
                    }
                  </p>

                </div>

                <div className="rounded-xl bg-slate-50 p-4">

                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Created
                  </p>

                  <p className="mt-1 text-xs font-bold text-slate-700">
                    {formatDate(
                      activeCalibration.created_at
                    )}
                  </p>

                </div>

              </div>

            </section>
          )}

          {/* FOOTER */}

          <footer className="mt-8 border-t border-slate-200 py-6">

            <div className="flex flex-col justify-between gap-2 text-[10px] text-slate-400 sm:flex-row">

              <p>
                SIMMS · Smart Classroom Infrastructure
                Monitoring System
              </p>

              <p>
                Administration Console · v1.0
              </p>

            </div>

          </footer>

        </main>

      </div>
    </div>
  );
}