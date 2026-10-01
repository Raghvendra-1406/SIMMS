import { useEffect, useRef, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  DetailItem,
  EmptyState,
  PageHeader,
  RefreshButton,
  Spinner,
  StatusBadge,
} from "../../components/ui";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

const CALIBRATION_STEPS = [
  "Select a classroom.",
  "Upload a camera image of the empty classroom.",
  "Choose what to draw: the board, a seat, or a fan.",
  "Click and drag over that area. Draw one box per seat or bench.",
  "The rectangle appears live while you drag.",
  "Save the calibration.",
];

const BOARD_TARGET = "board";
const SEAT_TARGET = "seat";
const FAN_TARGET_PREFIX = "fan:";

/*
 * Seat IDs are assigned in order: seat_01, seat_02, ...
 * Gaps left by removed seats are reused first.
 */
function getNextSeatId(seats) {
  const usedIds = new Set(
    seats.map((seat) => seat.seat_id)
  );

  let number = 1;

  while (
    usedIds.has(
      `seat_${String(number).padStart(2, "0")}`
    )
  ) {
    number += 1;
  }

  return `seat_${String(number).padStart(2, "0")}`;
}

function makeBox(start, point) {
  return {
    x1: Math.min(start.x, point.x),
    y1: Math.min(start.y, point.y),
    x2: Math.max(start.x, point.x),
    y2: Math.max(start.y, point.y),
  };
}

function toSavedBox(box) {
  return {
    x1: Math.round(Number(box.x1)),
    y1: Math.round(Number(box.y1)),
    x2: Math.round(Number(box.x2)),
    y2: Math.round(Number(box.y2)),
  };
}

export default function AdminCalibration() {
  const [classrooms, setClassrooms] = useState([]);
  const [devices, setDevices] = useState([]);

  const [selectedRoomId, setSelectedRoomId] =
    useState("");

  /*
   * What the next drawn box becomes:
   * "board", "seat", or "fan:<device_id>".
   */
  const [drawTarget, setDrawTarget] =
    useState("");

  const [imageFile, setImageFile] =
    useState(null);

  const [imageUrl, setImageUrl] =
    useState("");

  const [savedImagePath, setSavedImagePath] =
    useState("");

  const [fanBoxes, setFanBoxes] =
    useState([]);

  const [boardBox, setBoardBox] =
    useState(null);

  const [boardType, setBoardType] =
    useState("WHITEBOARD");

  const [seatBoxes, setSeatBoxes] =
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

  const [imageSize, setImageSize] =
    useState(null);

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
        setBoardBox(null);
        setSeatBoxes([]);
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

      const savedBoard =
        calibration?.calibration_data
          ?.board || null;

      setBoardBox(savedBoard);

      setBoardType(
        savedBoard?.board_type ||
          "WHITEBOARD"
      );

      const savedSeats =
        calibration?.calibration_data
          ?.seats || [];

      setSeatBoxes(
        Array.isArray(savedSeats)
          ? savedSeats
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
    setDrawTarget("");

    setImageFile(null);
    setImageUrl("");
    setSavedImagePath("");

    setFanBoxes([]);
    setBoardBox(null);
    setSeatBoxes([]);
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
    setBoardBox(null);
    setSeatBoxes([]);
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

    if (!drawTarget) {
      setError(
        "Choose what to draw before drawing an area."
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
    setCurrentBox(
      makeBox(point, point)
    );
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

    setCurrentBox(
      makeBox(drawStart, point)
    );
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

    commitBox(
      makeBox(drawStart, point)
    );
  };

  /*
   * ---------------------------------------------------------
   * STORE A FINISHED BOX FOR THE DRAW TARGET
   * ---------------------------------------------------------
   */

  const commitBox = (box) => {
    setCurrentBox(null);

    /*
     * Ignore tiny accidental clicks.
     */
    if (
      box.x2 - box.x1 < 10 ||
      box.y2 - box.y1 < 10
    ) {
      setError(
        "Please draw a larger area."
      );
      return;
    }

    if (drawTarget === BOARD_TARGET) {
      setBoardBox(box);

      setSuccess(
        "Board area selected. Drawing again replaces it."
      );
      return;
    }

    if (drawTarget === SEAT_TARGET) {
      setSeatBoxes((previous) => [
        ...previous,
        {
          seat_id: getNextSeatId(previous),
          ...box,
        },
      ]);

      setSuccess(
        "Seat added. Keep drawing to add the next seat."
      );
      return;
    }

    if (drawTarget.startsWith(FAN_TARGET_PREFIX)) {
      const deviceId = Number(
        drawTarget.slice(FAN_TARGET_PREFIX.length)
      );

      /*
       * Replace an existing box for the
       * same fan device.
       */
      setFanBoxes((previous) => [
        ...previous.filter(
          (fanBox) =>
            Number(fanBox.device_id) !==
            deviceId
        ),
        {
          device_id: deviceId,
          ...box,
        },
      ]);

      setSuccess(
        "Fan area selected. You can draw another area or save the calibration."
      );
    }
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
    if (!drawTarget) {
      setError(
        "Choose what to draw before drawing an area."
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

    setCurrentBox(
      makeBox(point, point)
    );
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

    setCurrentBox(
      makeBox(drawStart, point)
    );
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

    commitBox(currentBox);
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

  const removeSeatBox = (seatId) => {
    setSeatBoxes((previous) =>
      previous.filter(
        (box) => box.seat_id !== seatId
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

  const getDrawTargetLabel = () => {
    if (drawTarget === BOARD_TARGET) {
      return "Board";
    }

    if (drawTarget === SEAT_TARGET) {
      return getNextSeatId(seatBoxes);
    }

    if (drawTarget.startsWith(FAN_TARGET_PREFIX)) {
      return getDeviceName(
        drawTarget.slice(FAN_TARGET_PREFIX.length)
      );
    }

    return "";
  };

  const regionCount =
    fanBoxes.length +
    seatBoxes.length +
    (boardBox ? 1 : 0);

  /*
   * ---------------------------------------------------------
   * CONVERT ORIGINAL IMAGE COORDINATES
   * TO DISPLAY COORDINATES
   * ---------------------------------------------------------
   */

  const getDisplayBoxStyle = (
    box
  ) => {
    /*
     * Natural size is captured on image load, so rendering
     * does not read the image element through the ref.
     */
    if (!imageSize) {
      return {};
    }

    const naturalWidth =
      imageSize.width;

    const naturalHeight =
      imageSize.height;

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

    if (regionCount === 0) {
      setError(
        "Please draw at least one board, seat or fan area."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      /*
       * A newly selected image is uploaded first; the backend
       * stores it and returns the path used by the calibration.
       * Re-saving without a new image reuses the saved path.
       */
      let imagePath = savedImagePath;

      if (imageFile) {
        const formData = new FormData();
        formData.append("file", imageFile);

        const uploadResponse =
          await fetch(
            `${API_BASE_URL}/vision/calibration/image`,
            {
              method: "POST",
              headers: getAuthHeaders(),
              body: formData,
            }
          );

        const uploadResult =
          await uploadResponse.json();

        if (!uploadResponse.ok) {
          throw new Error(
            uploadResult.detail ||
              "Unable to upload the classroom image."
          );
        }

        imagePath = uploadResult.image_path;
      }

      const params = new URLSearchParams({
        room_id: String(Number(selectedRoomId)),
        image_path: imagePath,
      });

      const payload = {
        fans: fanBoxes.map(
          (box) => ({
            device_id:
              Number(box.device_id),
            ...toSavedBox(box),
          })
        ),

        seats: seatBoxes.map(
          (box) => ({
            seat_id: box.seat_id,
            ...toSavedBox(box),
          })
        ),

        board: boardBox
          ? {
              ...toSavedBox(boardBox),
              board_type: boardType,
            }
          : null,
      };

      const response =
        await fetch(
          `${API_BASE_URL}/vision/calibration?${params}`,
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
   * RELOAD REFERENCE DATA
   * ---------------------------------------------------------
   */

  const reloadReferenceData = () => {
    loadClassrooms();
    loadDevices();
  };

  const selectedRoom = classrooms.find(
    (room) =>
      String(room.room_id) ===
      String(selectedRoomId)
  );

  /*
   * Every drawn area, in one list for the side panel.
   */
  const regionItems = [
    ...(boardBox
      ? [
          {
            key: "board",
            label: `Board · ${
              boardType === "BLACKBOARD"
                ? "blackboard"
                : "whiteboard"
            }`,
            icon: "clipboard",
            iconClass: "bg-violet-50 text-violet-600",
            box: boardBox,
            onRemove: () => setBoardBox(null),
          },
        ]
      : []),

    ...seatBoxes.map((box) => ({
      key: `seat-${box.seat_id}`,
      label: box.seat_id,
      icon: "user",
      iconClass: "bg-emerald-50 text-emerald-700",
      box,
      onRemove: () => removeSeatBox(box.seat_id),
    })),

    ...fanBoxes.map((box) => ({
      key: `fan-${box.device_id}`,
      label: getDeviceName(box.device_id),
      icon: "fan",
      iconClass: "bg-brand-50 text-brand-600",
      box,
      onRemove: () => removeFanBox(box.device_id),
    })),
  ];

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <AppShell
      eyebrow="Infrastructure"
      title="Calibration"
      actions={
        <RefreshButton
          onClick={reloadReferenceData}
          loading={loading}
        />
      }
    >
      <PageHeader
        eyebrow="Camera configuration"
        title="Vision calibration"
        description="Select a classroom, upload its camera image, and draw the board, seat and fan areas directly on the image. The coordinates are stored for the SIMMS vision runtime."
      />

      {error && (
        <Alert
          tone="danger"
          title="Calibration error"
          onDismiss={() => setError("")}
          className="mb-6"
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          tone="success"
          title="Calibration updated"
          onDismiss={() => setSuccess("")}
          className="mb-6"
        >
          {success}
        </Alert>
      )}

      <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        {/* ================================================= */}
        {/* CONTROL PANEL */}
        {/* ================================================= */}

        <Card
          title="Calibration setup"
          subtitle="Choose the classroom and fan devices to calibrate"
          icon="settings"
          className="self-start"
        >
          <div className="space-y-5">
            {/* ROOM */}
            <div>
              <label
                htmlFor="calibration-room"
                className="label"
              >
                Classroom{" "}
                <span className="text-red-500">*</span>
              </label>

              <select
                id="calibration-room"
                value={selectedRoomId}
                onChange={handleRoomChange}
                className="select"
              >
                <option value="">
                  {loading
                    ? "Loading classrooms…"
                    : "Select classroom"}
                </option>

                {classrooms.map((room) => (
                  <option
                    key={room.room_id}
                    value={room.room_id}
                  >
                    {room.room_name ||
                      `Room ${room.room_id}`}
                  </option>
                ))}
              </select>
            </div>

            {/* IMAGE */}
            <div>
              <label
                htmlFor="calibration-image"
                className="label"
              >
                Classroom image{" "}
                <span className="text-red-500">*</span>
              </label>

              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-center transition-colors duration-150 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200 hover:border-brand-300 hover:bg-brand-50/40">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-slate-500 shadow-card ring-1 ring-slate-200 group-hover:text-brand-600">
                  <Icon
                    name="image"
                    className="h-5 w-5"
                  />
                </span>

                <span className="mt-3 text-sm font-semibold text-slate-800">
                  {imageFile
                    ? "Replace camera image"
                    : "Upload camera image"}
                </span>

                <span className="mt-0.5 text-xs text-slate-500">
                  PNG, JPG or JPEG
                </span>

                <input
                  id="calibration-image"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={
                    handleImageUpload
                  }
                  className="sr-only"
                />
              </label>

              {imageFile && (
                <p className="help-text flex items-center gap-1.5 truncate">
                  <Icon
                    name="image"
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className="truncate">
                    {imageFile.name}
                  </span>
                </p>
              )}
            </div>

            {/* DRAW TARGET */}
            <div>
              <label
                htmlFor="calibration-target"
                className="label"
              >
                Draw
              </label>

              <select
                id="calibration-target"
                value={drawTarget}
                onChange={(event) =>
                  setDrawTarget(
                    event.target.value
                  )
                }
                disabled={!selectedRoomId}
                className="select"
              >
                <option value="">
                  Choose what to draw
                </option>

                <option value={BOARD_TARGET}>
                  Board
                </option>

                <option value={SEAT_TARGET}>
                  Seats (one box per seat)
                </option>

                {fanDevices.length > 0 && (
                  <optgroup label="Fans">
                    {fanDevices.map((device) => (
                      <option
                        key={device.device_id}
                        value={`${FAN_TARGET_PREFIX}${device.device_id}`}
                      >
                        {device.device_name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {selectedRoomId &&
              fanDevices.length === 0 ? (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
                  <Icon
                    name="alert"
                    className="mt-px h-3.5 w-3.5 shrink-0"
                  />
                  No active fan devices are
                  registered for this classroom.
                  Board and seats can still be drawn.
                </p>
              ) : (
                <p className="help-text">
                  The next area you draw is saved
                  as this region.
                </p>
              )}
            </div>

            {/* BOARD TYPE */}
            {(drawTarget === BOARD_TARGET ||
              boardBox) && (
              <div>
                <label
                  htmlFor="calibration-board-type"
                  className="label"
                >
                  Board type
                </label>

                <select
                  id="calibration-board-type"
                  value={boardType}
                  onChange={(event) =>
                    setBoardType(
                      event.target.value
                    )
                  }
                  className="select"
                >
                  <option value="WHITEBOARD">
                    Whiteboard (dark marker)
                  </option>

                  <option value="BLACKBOARD">
                    Blackboard / greenboard (chalk)
                  </option>
                </select>
              </div>
            )}

            {/* INSTRUCTIONS */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                <Icon
                  name="info"
                  className="h-4 w-4 text-brand-600"
                />
                How to calibrate
              </p>

              <ol className="mt-3 space-y-2">
                {CALIBRATION_STEPS.map(
                  (step, index) => (
                    <li
                      key={step}
                      className="flex items-start gap-2.5 text-xs leading-5 text-slate-600"
                    >
                      <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  )
                )}
              </ol>
            </div>

            {/* CURRENT BOXES */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="eyebrow">
                  Calibrated areas
                </p>

                <span className="num rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {regionCount}
                </span>
              </div>

              {regionItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-4 py-5 text-center">
                  <p className="text-[13px] font-medium text-slate-500">
                    No areas drawn
                  </p>
                </div>
              ) : (
                <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                  {regionItems.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.iconClass}`}>
                        <Icon
                          name={item.icon}
                          className="h-4 w-4"
                        />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-900">
                          {item.label}
                        </p>

                        <p className="num mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                          ({item.box.x1}, {item.box.y1})
                          <Icon
                            name="arrowRight"
                            className="h-3 w-3"
                          />
                          ({item.box.x2}, {item.box.y2})
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={item.onRemove}
                        className="btn btn-sm btn-danger-soft"
                        aria-label={`Remove area for ${item.label}`}
                      >
                        <Icon
                          name="trash"
                          className="h-3.5 w-3.5"
                        />
                        <span className="hidden sm:inline">
                          Remove
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* SAVE */}
            <button
              type="button"
              onClick={saveCalibration}
              disabled={
                saving ||
                !selectedRoomId ||
                regionCount === 0
              }
              className="btn btn-primary w-full"
            >
              {saving ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : (
                <>
                  <Icon
                    name="save"
                    className="h-4 w-4"
                  />
                  Save calibration
                </>
              )}
            </button>
          </div>
        </Card>

        {/* ================================================= */}
        {/* IMAGE AREA */}
        {/* ================================================= */}

        <Card
          title="Detection areas"
          subtitle="Draw rectangles over the board, each seat and each fan"
          icon="crosshair"
          actions={
            loadingCalibration ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11.5px] font-medium text-slate-600">
                <Spinner className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  Loading calibration…
                </span>
              </span>
            ) : selectedRoom ? (
              <span className="hidden truncate text-xs font-medium text-slate-500 sm:inline">
                {selectedRoom.room_name ||
                  `Room ${selectedRoom.room_id}`}
              </span>
            ) : null
          }
        >
          {!imageUrl ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70">
              <EmptyState
                icon="image"
                title="No classroom image selected"
                description="Select a classroom and upload its camera image to begin calibration."
              />
            </div>
          ) : (
            <div className="rounded-xl bg-ink-950 p-2 sm:p-3">
              {/* IMAGE CANVAS */}
              <div
                className="relative mx-auto w-full max-w-[1100px] select-none overflow-hidden rounded-lg"
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
                    drawTarget
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
                  onLoad={(event) => {
                    setCurrentBox(null);

                    const { naturalWidth, naturalHeight } =
                      event.currentTarget;

                    setImageSize(
                      naturalWidth && naturalHeight
                        ? {
                            width: naturalWidth,
                            height: naturalHeight,
                          }
                        : null
                    );
                  }}
                />

                {/* SAVED BOARD BOX */}
                {boardBox && (
                  <div
                    className="pointer-events-none absolute border-2 border-violet-400 bg-violet-400/15 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                    style={getDisplayBoxStyle(
                      boardBox
                    )}
                  >
                    <div className="absolute -top-7 left-0 whitespace-nowrap rounded-md bg-accent px-2 py-1 text-[10.5px] font-semibold text-white shadow-raised">
                      Board
                    </div>
                  </div>
                )}

                {/* SAVED SEAT BOXES */}
                {seatBoxes.map((box) => (
                  <div
                    key={`seat-${box.seat_id}`}
                    className="pointer-events-none absolute border-2 border-emerald-400 bg-emerald-400/15 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                    style={getDisplayBoxStyle(
                      box
                    )}
                  >
                    <div className="absolute left-0 top-0 whitespace-nowrap rounded-br-md bg-success px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {box.seat_id.replace("seat_", "")}
                    </div>
                  </div>
                ))}

                {/* SAVED FAN BOXES */}
                {fanBoxes.map((box) => (
                  <div
                    key={`saved-${box.device_id}`}
                    className="pointer-events-none absolute border-2 border-brand-400 bg-brand-400/15 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                    style={getDisplayBoxStyle(
                      box
                    )}
                  >
                    <div className="absolute -top-7 left-0 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[10.5px] font-semibold text-white shadow-raised">
                      {getDeviceName(
                        box.device_id
                      )}
                    </div>
                  </div>
                ))}

                {/* LIVE DRAWING BOX */}
                {currentBox && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-amber-400 bg-amber-400/20"
                    style={getDisplayBoxStyle(
                      currentBox
                    )}
                  >
                    <div className="absolute -top-7 left-0 whitespace-nowrap rounded-md bg-amber-500 px-2 py-1 text-[10.5px] font-semibold text-ink-950 shadow-raised">
                      {getDrawTargetLabel()}{" "}
                      · drawing
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CANVAS STATUS */}
          {imageUrl && (
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
                <dt className="text-xs font-medium text-slate-500">
                  Board · seats · fans
                </dt>
                <dd className="num mt-1 text-xl font-semibold text-slate-900">
                  {boardBox ? 1 : 0} · {seatBoxes.length} · {fanBoxes.length}
                </dd>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
                <dt className="text-xs font-medium text-slate-500">
                  Canvas mode
                </dt>
                <dd className="mt-1.5">
                  {drawTarget ? (
                    <StatusBadge
                      tone="brand"
                      label={`Drawing: ${getDrawTargetLabel()}`}
                    />
                  ) : (
                    <StatusBadge
                      tone="neutral"
                      label="Choose what to draw"
                    />
                  )}
                </dd>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
                <dt className="text-xs font-medium text-slate-500">
                  Calibration
                </dt>
                <dd className="mt-1.5">
                  {activeCalibration ? (
                    <StatusBadge
                      tone="success"
                      label={`v${activeCalibration.calibration_version}`}
                    />
                  ) : (
                    <StatusBadge
                      tone="info"
                      label="New"
                    />
                  )}
                </dd>
              </div>
            </dl>
          )}

          {/* COORDINATE INFO */}
          {currentBox && (
            <div
              className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
              aria-live="polite"
            >
              <Icon
                name="target"
                className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-amber-900">
                  Drawing {getDrawTargetLabel()}
                </p>

                <p className="num mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-amber-800">
                  <span>X: {currentBox.x1}</span>
                  <Icon
                    name="arrowRight"
                    className="h-3 w-3"
                  />
                  <span>{currentBox.x2}</span>
                  <span
                    aria-hidden="true"
                    className="px-1"
                  >
                    ·
                  </span>
                  <span>Y: {currentBox.y1}</span>
                  <Icon
                    name="arrowRight"
                    className="h-3 w-3"
                  />
                  <span>{currentBox.y2}</span>
                </p>
              </div>
            </div>
          )}
        </Card>
      </section>

      {/* ================================================= */}
      {/* ACTIVE CALIBRATION */}
      {/* ================================================= */}

      {activeCalibration && (
        <Card
          className="mt-6"
          title="Active calibration"
          subtitle="This calibration is currently active for the selected classroom"
          icon="calibration"
          actions={
            <StatusBadge status="ACTIVE" />
          }
        >
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailItem label="Version" mono>
              v
              {
                activeCalibration.calibration_version
              }
            </DetailItem>

            <DetailItem label="Room" mono>
              {activeCalibration.room_id}
            </DetailItem>

            <DetailItem label="Board · seats · fans" mono>
              {activeCalibration.calibration_data
                ?.board
                ? 1
                : 0}{" "}
              ·{" "}
              {activeCalibration.calibration_data
                ?.seats?.length || 0}{" "}
              ·{" "}
              {activeCalibration.calibration_data
                ?.fans?.length || 0}
            </DetailItem>

            <DetailItem label="Created" mono>
              {formatDate(
                activeCalibration.created_at
              )}
            </DetailItem>
          </dl>
        </Card>
      )}
    </AppShell>
  );
}
