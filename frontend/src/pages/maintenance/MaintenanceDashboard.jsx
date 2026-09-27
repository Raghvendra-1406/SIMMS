import { useEffect, useMemo, useState } from "react";

const API_BASE_URL = "http://localhost:8000"; 
 
function MaintenanceDashboard() { 
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); 
 
  const [tickets, setTickets] = useState([]); 
  const [classrooms, setClassrooms] = useState([]); 
  const [faults, setFaults] = useState([]); 
 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(""); 
 
  const maintenanceName = 
    localStorage.getItem("name") || "Maintenance Staff"; 
 
  const maintenanceEmail = 
    localStorage.getItem("email") || ""; 
 
  const token = localStorage.getItem("access_token"); 
 
  const navigateTo = (path) => { 
    window.location.href = path; 
  }; 
 
  const handleLogout = () => { 
    localStorage.clear(); 
    window.location.href = "/"; 
  }; 
 
  useEffect(() => { 
    const loadDashboard = async () => { 
      if (!token) { 
        window.location.href = "/"; 
        return; 
      } 
 
      setLoading(true); 
      setError(""); 
 
      try { 
        const headers = { 
          Authorization: `Bearer ${token}`, 
        }; 
 
        const [ 
          ticketsResponse, 
          classroomsResponse, 
          faultsResponse, 
        ] = await Promise.all([ 
          fetch(`${API_BASE_URL}/tickets/open`, { 
            headers, 
          }), 
          fetch(`${API_BASE_URL}/classrooms`, { 
            headers, 
          }), 
          fetch(`${API_BASE_URL}/faults/active`, { 
            headers, 
          }), 
        ]); 
 
        if (!ticketsResponse.ok) { 
          throw new Error( 
            "Unable to load open maintenance tickets." 
          ); 
        } 
 
        if (!classroomsResponse.ok) { 
          throw new Error( 
            "Unable to load classrooms." 
          ); 
        } 
 
        if (!faultsResponse.ok) { 
          throw new Error( 
            "Unable to load active faults." 
          ); 
        } 
 
        const ticketsResult = 
          await ticketsResponse.json(); 
 
        const classroomsResult = 
          await classroomsResponse.json(); 
 
        const faultsResult = 
          await faultsResponse.json(); 
 
        setTickets( 
          Array.isArray(ticketsResult) 
            ? ticketsResult 
            : [] 
        ); 
 
        setClassrooms( 
          Array.isArray(classroomsResult) 
            ? classroomsResult 
            : [] 
        ); 
 
        setFaults( 
          Array.isArray(faultsResult) 
            ? faultsResult 
            : [] 
        ); 
      } catch (err) { 
        setError( 
          err.message || 
            "Unable to load maintenance dashboard." 
        ); 
      } finally { 
        setLoading(false); 
      } 
    }; 
 
    loadDashboard(); 
  }, [token]); 
 
  const classroomMap = useMemo(() => { 
    const map = {}; 
 
    classrooms.forEach((classroom) => { 
      map[classroom.room_id] = classroom; 
    }); 
 
    return map; 
  }, [classrooms]); 
 
  const faultMap = useMemo(() => { 
    const map = {}; 
 
    faults.forEach((fault) => { 
      map[fault.fault_id] = fault; 
    }); 
 
    return map; 
  }, [faults]); 
 
  const ticketSummary = useMemo(() => { 
    let open = 0; 
    let highPriority = 0; 
 
    tickets.forEach((ticket) => { 
      const status = String( 
        ticket.status || "" 
      ).toUpperCase(); 
 
      const priority = String( 
        ticket.priority || "" 
      ).toUpperCase(); 
 
      if (status === "OPEN") { 
        open += 1; 
      } 
 
      if ( 
        priority === "HIGH" || 
        priority === "CRITICAL" 
      ) { 
        highPriority += 1; 
      } 
    }); 
 
    return { 
      open, 
      highPriority, 
    }; 
  }, [tickets]); 
 
  const getClassroomName = (roomId) => { 
    const classroom = classroomMap[roomId]; 
 
    if (!classroom) { 
      return `Room ${roomId}`; 
    } 
 
    return ( 
      classroom.room_name || 
      `Room ${roomId}` 
    ); 
  }; 
 
  const getFaultForTicket = (ticket) => { 
    if (!ticket?.fault_id) { 
      return null; 
    } 
 
    return faultMap[ticket.fault_id] || null; 
  }; 
 
  const getFaultType = (ticket) => { 
    const fault = getFaultForTicket(ticket); 
 
    return ( 
      fault?.fault_type || 
      "Infrastructure fault" 
    ); 
  }; 
 
  const getRoomForTicket = (ticket) => { 
    const fault = getFaultForTicket(ticket); 
 
    if (!fault) { 
      return "—"; 
    } 
 
    return getClassroomName( 
      fault.room_id 
    ); 
  }; 
 
  const getPriorityBadge = (priority) => { 
    const normalized = String( 
      priority || "" 
    ).toUpperCase(); 
 
    if (normalized === "CRITICAL") { 
      return "border-red-200 bg-red-50 text-red-700"; 
    } 
 
    if (normalized === "HIGH") { 
      return "border-orange-200 bg-orange-50 text-orange-700"; 
    } 
 
    if (normalized === "MEDIUM") { 
      return "border-amber-200 bg-amber-50 text-amber-700"; 
    } 
 
    return "border-slate-200 bg-slate-50 text-slate-600"; 
  }; 
 
  const getStatusBadge = (status) => { 
    const normalized = String( 
      status || "" 
    ).toUpperCase(); 
 
    if (normalized === "OPEN") { 
      return "border-cyan-200 bg-cyan-50 text-cyan-700"; 
    } 
 
    if (normalized === "RESOLVED") { 
      return "border-emerald-200 bg-emerald-50 text-emerald-700"; 
    } 
 
    if (normalized === "CLOSED") { 
      return "border-slate-200 bg-slate-50 text-slate-600"; 
    } 
 
    return "border-slate-200 bg-slate-50 text-slate-600"; 
  }; 
 
  const formatDate = (value) => { 
    if (!value) { 
      return "—"; 
    } 
 
    const date = new Date(value); 
 
    if (Number.isNaN(date.getTime())) { 
      return "—"; 
    } 
 
    return date.toLocaleString(); 
  }; 
 
  const formatFaultType = (faultType) => { 
    if (!faultType) { 
      return "Infrastructure fault"; 
    } 
 
    return String(faultType) 
      .replaceAll("_", " ") 
      .toLowerCase() 
      .replace(/\b\w/g, (letter) => 
        letter.toUpperCase() 
      ); 
  }; 
 
  return ( 
    <div className="min-h-screen bg-slate-50"> 
      {/* Sidebar */} 
      <aside 
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col bg-slate-950 transition-all duration-300 lg:flex ${ 
          sidebarCollapsed 
            ? "w-[76px]" 
            : "w-64" 
        }`} 
      > 
        {/* Brand */} 
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
                  Maintenance Console 
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
              title="Collapse sidebar" 
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-white" 
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
              className="absolute -right-3 top-6 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-sm font-bold text-cyan-300 shadow-lg transition hover:bg-slate-800" 
            > 
              › 
            </button> 
          )} 
        </div> 
 
        {/* Navigation */} 
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
              path="/maintenance/dashboard" 
              active 
              collapsed={sidebarCollapsed} 
              navigateTo={navigateTo} 
            /> 
 
            <NavigationItem 
              icon="⌘" 
              label="Tickets" 
              path="/maintenance/tickets" 
              collapsed={sidebarCollapsed} 
              navigateTo={navigateTo} 
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
                SIMMS is monitoring classroom 
                infrastructure and maintenance 
                activity. 
              </p> 
            </div> 
          )} 
 
          {sidebarCollapsed && ( 
            <div 
              title="Monitoring active" 
              className="mx-auto mt-8 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10" 
            > 
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> 
            </div> 
          )} 
        </div> 
 
        {/* Footer */} 
        <div className="border-t border-white/10 p-3"> 
          {!sidebarCollapsed && ( 
            <div className="mb-3 rounded-xl bg-white/5 p-3"> 
              <p className="truncate text-xs font-semibold text-white"> 
                {maintenanceName} 
              </p> 
 
              <p className="mt-1 truncate text-[10px] text-slate-500"> 
                {maintenanceEmail || 
                  "Maintenance Staff"} 
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
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5"> 
              ↪ 
            </span> 
 
            {!sidebarCollapsed && ( 
              <span>Logout</span> 
            )} 
          </button> 
        </div> 
      </aside> 
 
      {/* Main */} 
      <div 
        className={`min-h-screen transition-all duration-300 ${ 
          sidebarCollapsed 
            ? "lg:pl-[76px]" 
            : "lg:pl-64" 
        }`} 
      > 
        {/* Top bar */} 
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"> 
          <div className="flex h-20 items-center justify-between px-5 sm:px-8"> 
            <div className="flex items-center gap-4"> 
              {/* Mobile brand */} 
              <div className="flex items-center gap-3 lg:hidden"> 
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400 text-sm font-black text-slate-950"> 
                  S 
                </div> 
 
                <div> 
                  <p className="font-black tracking-[0.16em] text-slate-900"> 
                    SIMMS 
                  </p> 
 
                  <p className="text-[9px] uppercase tracking-[0.12em] text-slate-400"> 
                    Maintenance 
                  </p> 
                </div> 
              </div> 
 
              <div className="hidden lg:block"> 
                <p className="text-sm font-semibold text-slate-900"> 
                  Maintenance Dashboard 
                </p> 
 
                <p className="mt-0.5 text-xs text-slate-400"> 
                  Maintenance work queue and classroom faults 
                </p> 
              </div> 
            </div> 
 
            <div className="flex items-center gap-3"> 
              <div className="hidden text-right sm:block"> 
                <p className="text-xs font-semibold text-slate-700"> 
                  {maintenanceName} 
                </p> 
 
                <p className="text-[10px] text-slate-400"> 
                  Maintenance Staff 
                </p> 
              </div> 
 
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-cyan-300"> 
                {maintenanceName 
                  .charAt(0) 
                  .toUpperCase()} 
              </div> 
            </div> 
          </div> 
        </header> 
 
        {/* Page content */} 
        <main className="px-5 py-7 sm:px-8"> 
          {/* Heading */} 
          <div className="mb-7"> 
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600"> 
              Maintenance operations 
            </p> 
 
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"> 
              Maintenance work queue 
            </h1> 
 
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500"> 
              Review confirmed infrastructure faults 
              and work through open maintenance tickets. 
            </p> 
          </div> 
 
          {/* Error */} 
          {error && ( 
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4"> 
              <p className="text-sm font-semibold text-red-700"> 
                {error} 
              </p> 
 
              <p className="mt-1 text-xs text-red-500"> 
                Please check that the SIMMS backend 
                is running and try again. 
              </p> 
            </div> 
          )} 
 
          {/* Summary cards */} 
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"> 
            <SummaryCard 
              label="Open Tickets" 
              value={ 
                loading 
                  ? "—" 
                  : ticketSummary.open 
              } 
              icon="⌘" 
            /> 
 
            <SummaryCard 
              label="High Priority" 
              value={ 
                loading 
                  ? "—" 
                  : ticketSummary.highPriority 
              } 
              icon="⚠" 
              valueClass="text-orange-600" 
            /> 
 
            <SummaryCard 
              label="Active Faults" 
              value={ 
                loading 
                  ? "—" 
                  : faults.length 
              } 
              icon="!" 
              valueClass="text-red-600" 
            /> 
          </div> 
 
          {/* Work queue + quick information */} 
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]"> 
            {/* Open tickets */} 
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"> 
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6"> 
                <div> 
                  <h2 className="text-sm font-bold text-slate-900"> 
                    Maintenance work queue 
                  </h2> 
 
                  <p className="mt-1 text-xs text-slate-400"> 
                    Open tickets requiring maintenance attention 
                  </p> 
                </div> 
 
                <button 
                  type="button" 
                  onClick={() => 
                    navigateTo( 
                      "/maintenance/tickets" 
                    ) 
                  } 
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-cyan-600 transition hover:bg-cyan-50" 
                > 
                  View all 
                </button> 
              </div> 
 
              {loading ? ( 
                <div className="space-y-3 p-5"> 
                  {[1, 2, 3, 4].map((item) => ( 
                    <div 
                      key={item} 
                      className="h-20 animate-pulse rounded-xl bg-slate-100" 
                    /> 
                  ))} 
                </div> 
              ) : tickets.length === 0 ? ( 
                <EmptyState 
                  message="No open maintenance tickets." 
                /> 
              ) : ( 
                <div className="overflow-x-auto"> 
                  <table className="w-full min-w-[780px]"> 
                    <thead> 
                      <tr className="border-b border-slate-100 text-left"> 
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"> 
                          Ticket 
                        </th> 
 
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"> 
                          Classroom 
                        </th> 
 
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"> 
                          Fault 
                        </th> 
 
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"> 
                          Priority 
                        </th> 
 
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"> 
                          Status 
                        </th> 
 
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"> 
                          Created 
                        </th> 
                      </tr> 
                    </thead> 
 
                    <tbody> 
                      {tickets 
                        .slice(0, 8) 
                        .map((ticket) => ( 
                          <tr 
                            key={ticket.ticket_id} 
                            onClick={() => 
                              navigateTo( 
                                `/maintenance/tickets/${ticket.ticket_id}` 
                              ) 
                            } 
                            className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50" 
                          > 
                            <td className="px-5 py-4"> 
                              <p className="text-sm font-bold text-slate-800"> 
                                #{ticket.ticket_id} 
                              </p> 
 
                              <p className="mt-0.5 text-[10px] text-slate-400"> 
                                Fault # 
                                {ticket.fault_id || 
                                  "—"} 
                              </p> 
                            </td> 
 
                            <td className="px-5 py-4"> 
                              <p className="text-sm font-semibold text-slate-700"> 
                                {getRoomForTicket( 
                                  ticket 
                                )} 
                              </p> 
                            </td> 
 
                            <td className="px-5 py-4"> 
                              <p className="text-sm text-slate-600"> 
                                {formatFaultType( 
                                  getFaultType( 
                                    ticket 
                                  ) 
                                )} 
                              </p> 
                            </td> 
 
                            <td className="px-5 py-4"> 
                              <span 
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${getPriorityBadge( 
                                  ticket.priority 
                                )}`} 
                              > 
                                {ticket.priority || 
                                  "—"} 
                              </span> 
                            </td> 
 
                            <td className="px-5 py-4"> 
                              <span 
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${getStatusBadge( 
                                  ticket.status 
                                )}`} 
                              > 
                                {String( 
                                  ticket.status || 
                                    "OPEN" 
                                ).replaceAll( 
                                  "_", 
                                  " " 
                                )} 
                              </span> 
                            </td> 
 
                            <td className="px-5 py-4 text-xs text-slate-400"> 
                              {formatDate( 
                                ticket.created_at 
                              )} 
                            </td> 
                          </tr> 
                        ))} 
                    </tbody> 
                  </table> 
                </div> 
              )} 
            </section> 
 
            {/* Maintenance overview */} 
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"> 
              <div className="border-b border-slate-100 px-5 py-5"> 
                <h2 className="text-sm font-bold text-slate-900"> 
                  Maintenance overview 
                </h2> 
 
                <p className="mt-1 text-xs text-slate-400"> 
                  Current infrastructure issues requiring attention 
                </p> 
              </div> 
 
              <div className="space-y-4 p-5"> 
                {loading ? ( 
                  <> 
                    {[1, 2, 3].map((item) => ( 
                      <div 
                        key={item} 
                        className="h-20 animate-pulse rounded-xl bg-slate-100" 
                      /> 
                    ))} 
                  </> 
                ) : faults.length === 0 ? ( 
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5"> 
                    <div className="flex items-center gap-3"> 
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600"> 
                        ✓ 
                      </div> 
 
                      <div> 
                        <p className="text-sm font-bold text-emerald-800"> 
                          No active faults 
                        </p> 
 
                        <p className="mt-1 text-xs text-emerald-600"> 
                          No confirmed infrastructure fault 
                          is currently active. 
                        </p> 
                      </div> 
                    </div> 
                  </div> 
                ) : ( 
                  faults 
                    .slice(0, 5) 
                    .map((fault) => ( 
                      <button 
                        type="button" 
                        key={fault.fault_id} 
                        onClick={() => 
                          navigateTo( 
                            `/maintenance/tickets/${ 
                              tickets.find( 
                                (ticket) => 
                                  ticket.fault_id === 
                                  fault.fault_id 
                              )?.ticket_id || "" 
                            }` 
                          ) 
                        } 
                        className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-red-200 hover:bg-red-50/30" 
                      > 
                        <div className="flex items-start justify-between gap-3"> 
                          <div> 
                            <p className="text-xs font-bold text-red-600"> 
                              {formatFaultType( 
                                fault.fault_type 
                              )} 
                            </p> 
 
                            <p className="mt-1 text-sm font-semibold text-slate-800"> 
                              {getClassroomName( 
                                fault.room_id 
                              )} 
                            </p> 
 
                            {fault.device_id !== 
                              null && 
                              fault.device_id !== 
                                undefined && ( 
                                <p className="mt-1 text-[10px] text-slate-400"> 
                                  Device ID:{" "} 
                                  {fault.device_id} 
                                </p> 
                              )} 
                          </div> 
 
                          <span className="rounded-lg bg-red-100 px-2 py-1 text-[10px] font-bold text-red-600"> 
                            {fault.status || 
                              "ACTIVE"} 
                          </span> 
                        </div> 
 
                        <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400"> 
                          <span> 
                            Abnormal observations:{" "} 
                            {fault.abnormal_count ?? 
                              "—"} 
                          </span> 
 
                          <span> 
                            {formatDate( 
                              fault.confirmed_at || 
                                fault.detected_at 
                            )} 
                          </span> 
                        </div> 
                      </button> 
                    )) 
                )} 
              </div> 
            </section> 
          </div> 
 
          {/* Ticket information */} 
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm"> 
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6"> 
              <h2 className="text-sm font-bold text-slate-900"> 
                Maintenance workflow 
              </h2> 
 
              <p className="mt-1 text-xs text-slate-400"> 
                Current ticket lifecycle used by SIMMS 
              </p> 
            </div> 
 
            <div className="grid gap-4 p-5 sm:grid-cols-3"> 
              <WorkflowStep 
                number="01" 
                title="Open" 
                description="Review the confirmed maintenance ticket." 
                active 
              /> 
 
              <WorkflowStep 
                number="02" 
                title="Resolved" 
                description="Mark the ticket resolved after the fault has been repaired." 
              /> 
 
              <WorkflowStep 
                number="03" 
                title="Closed" 
                description="Close the completed maintenance ticket." 
              /> 
            </div> 
          </section> 
 
          {/* Footer */} 
          <div className="mt-6 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between"> 
            <p> 
              SIMMS Maintenance Console 
            </p> 
 
            <p> 
              {loading 
                ? "Loading maintenance data..." 
                : `${tickets.length} open maintenance ticket${ 
                    tickets.length === 1 
                      ? "" 
                      : "s" 
                  } currently available`} 
            </p> 
          </div> 
        </main> 
      </div> 
    </div> 
  ); 
} 
 
function NavigationItem({ 
  icon, 
  label, 
  path, 
  active, 
  collapsed, 
  navigateTo, 
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
 
function SummaryCard({ 
  label, 
  value, 
  icon, 
  valueClass = "text-slate-900", 
}) { 
  return ( 
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"> 
      <div className="flex items-center justify-between"> 
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400"> 
          {label} 
        </p> 
 
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-500"> 
          {icon} 
        </div> 
      </div> 
 
      <p 
        className={`mt-4 text-2xl font-black tracking-tight ${valueClass}`} 
      > 
        {value} 
      </p> 
    </div> 
  ); 
} 
 
function WorkflowStep({ 
  number, 
  title, 
  description, 
  active = false, 
}) { 
  return ( 
    <div 
      className={`rounded-xl border p-4 ${ 
        active 
          ? "border-cyan-200 bg-cyan-50/50" 
          : "border-slate-100 bg-slate-50" 
      }`} 
    > 
      <div className="flex items-center gap-3"> 
        <div 
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-[10px] font-black ${ 
            active 
              ? "bg-cyan-500 text-white" 
              : "bg-white text-slate-500" 
          }`} 
        > 
          {number} 
        </div> 
 
        <p className="text-sm font-bold text-slate-800"> 
          {title} 
        </p> 
      </div> 
 
      <p className="mt-3 text-xs leading-5 text-slate-500"> 
        {description} 
      </p> 
    </div> 
  ); 
} 
 
function EmptyState({ message }) { 
  return ( 
    <div className="px-5 py-10 text-center"> 
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"> 
        — 
      </div> 
 
      <p className="mt-3 text-sm font-semibold text-slate-600"> 
        {message} 
      </p> 
    </div> 
  ); 
} 
 
export default MaintenanceDashboard;
