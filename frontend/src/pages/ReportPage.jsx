import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createReport, fetchReport } from "../api.js";
import CategoryBadge from "../components/CategoryBadge.jsx";

const INDIAN_CITIES = [
  { name: "New Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
];

const I18N = {
  en: {
    title: "Report a Pothole",
    subtitle: "Capture damaged roads. Our AI triages severity for civic repair crews.",
    langBtn: "हिंदी",
    takePhoto: "Take photo with camera",
    changePhoto: "Change photo",
    selectedImage: "Photo selected",
    gpsAcquiring: "Acquiring GPS coordinates…",
    gpsSuccess: "GPS Location Locked",
    accuracy: "accuracy",
    gpsWeak: "GPS accuracy is worse than 100 m. You can still submit.",
    gpsDenied: "GPS access denied or unavailable. Please pick a city or enter coordinates below.",
    manualToggle: "Manual Location / Choose City",
    selectCity: "Select nearest Indian city",
    latitude: "Latitude",
    longitude: "Longitude",
    accuracyLabel: "GPS Accuracy (m)",
    submit: "Submit Report",
    uploading: "Uploading report…",
    errorNoFile: "Please take or choose a photo first.",
    errorNoCoords: "Please provide valid coordinates within India.",
    thanksTitle: "Report Submitted!",
    thanksMsg: "Your report is being triaged by the AI worker.",
    reportId: "Report ID",
    statusLabel: "Triage Status",
    viewOnMap: "View on Map",
    reportAnother: "Report Another Pothole",
    aiResultTitle: "AI Triage Result",
    analyzing: "AI Analyzing road condition…",
  },
  hi: {
    title: "सड़क के गड्ढे की शिकायत करें",
    subtitle: "क्षतिग्रस्त सड़क की फोटो लें। हमारा AI इसकी प्राथमिकता तय कर अधिकारियों तक पहुंचाएगा।",
    langBtn: "English",
    takePhoto: "कैमरे से फोटो खींचें",
    changePhoto: "फोटो बदलें",
    selectedImage: "फोटो चुनी गई",
    gpsAcquiring: "GPS लोकेशन प्राप्त की जा रही है…",
    gpsSuccess: "GPS लोकेशन प्राप्त हुई",
    accuracy: "सटीकता",
    gpsWeak: "GPS सटीकता 100 मीटर से कम है। आप फिर भी सबमिट कर सकते हैं।",
    gpsDenied: "GPS अनुमति अस्वीकृत या अनुपलब्ध है। कृपया नीचे शहर चुनें या निर्देशांक दर्ज करें।",
    manualToggle: "मैन्युअल लोकेशन / शहर चुनें",
    selectCity: "निकटतम भारतीय शहर चुनें",
    latitude: "अक्षांश (Latitude)",
    longitude: "देशांतर (Longitude)",
    accuracyLabel: "GPS सटीकता (मीटर)",
    submit: "शिकायत दर्ज करें",
    uploading: "अपलोड हो रहा है…",
    errorNoFile: "कृपया पहले एक फोटो लें या चुनें।",
    errorNoCoords: "कृपया भारत के भीतर मान्य निर्देशांक प्रदान करें।",
    thanksTitle: "शिकायत दर्ज हो गई!",
    thanksMsg: "आपकी शिकायत की AI द्वारा जांच की जा रही है।",
    reportId: "रिपोर्ट आईडी",
    statusLabel: "जांच स्थिति",
    viewOnMap: "मानचित्र पर देखें",
    reportAnother: "अन्य गड्ढे की शिकायत करें",
    aiResultTitle: "AI जांच का परिणाम",
    analyzing: "AI सड़क की स्थिति का विश्लेषण कर रहा है…",
  },
};

export default function ReportPage() {
  const inputRef = useRef(null);
  const [lang, setLang] = useState("en");
  const t = I18N[lang];

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [geoWarning, setGeoWarning] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState("28.6139");
  const [manualLng, setManualLng] = useState("77.2090");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [liveReport, setLiveReport] = useState(null);
  const [error, setError] = useState("");

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoWarning(t.gpsDenied);
      setManualMode(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        setCoords({ lat, lng });
        setManualLat(lat.toFixed(5));
        setManualLng(lng.toFixed(5));
        setAccuracy(acc);
        if (acc > 100) {
          setGeoWarning(t.gpsWeak);
        } else {
          setGeoWarning("");
        }
      },
      () => {
        setGeoWarning(t.gpsDenied);
        setManualMode(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onFile = (e) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    setDone(null);
    setLiveReport(null);
    requestLocation();
  };

  const handleCitySelect = (e) => {
    const cityName = e.target.value;
    const city = INDIAN_CITIES.find((c) => c.name === cityName);
    if (city) {
      setManualLat(city.lat.toString());
      setManualLng(city.lng.toString());
      setCoords({ lat: city.lat, lng: city.lng });
      setAccuracy(25);
      setGeoWarning("");
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError(t.errorNoFile);
      return;
    }

    const finalLat = parseFloat(manualLat);
    const finalLng = parseFloat(manualLng);

    if (isNaN(finalLat) || isNaN(finalLng) || finalLat < 6 || finalLat > 37 || finalLng < 68 || finalLng > 98) {
      setError(t.errorNoCoords);
      return;
    }

    setBusy(true);
    try {
      const result = await createReport({
        file,
        lat: finalLat,
        lng: finalLng,
        accuracy_m: accuracy || 15,
      });
      setDone(result);
      setLiveReport({ id: result.id, status: result.status });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setError(typeof detail === "string" ? detail : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  // Poll for report status when submitted
  useEffect(() => {
    if (!done?.id) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const rep = await fetchReport(done.id);
        if (!cancelled) {
          setLiveReport(rep);
          if (rep.status === "processed" || rep.status === "failed" || attempts >= 8) {
            return;
          }
        }
      } catch (err) {
        console.error("Poll error", err);
      }
      attempts++;
      if (!cancelled && attempts < 8) {
        setTimeout(poll, 1500);
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [done]);

  if (done) {
    const isProcessed = liveReport?.status === "processed";
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 text-center space-y-5">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
            ✓
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t.thanksTitle}</h1>
          <p className="text-slate-600 text-sm">{t.thanksMsg}</p>

          <div className="bg-slate-50 p-3 rounded-xl text-xs font-mono text-slate-500 break-all">
            {t.reportId}: {done.id}
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2">
            <div className="text-sm font-semibold text-slate-700 flex items-center justify-center gap-2">
              <span>{t.statusLabel}:</span>
              {liveReport?.status === "pending" && (
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-amber-100 text-amber-800 animate-pulse">
                  Pending Triage
                </span>
              )}
              {liveReport?.status === "processing" && (
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-blue-100 text-blue-800 animate-pulse">
                  AI Processing
                </span>
              )}
              {liveReport?.status === "processed" && (
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-emerald-100 text-emerald-800">
                  Processed
                </span>
              )}
              {liveReport?.status === "failed" && (
                <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-red-100 text-red-800">
                  Failed
                </span>
              )}
            </div>

            {isProcessed ? (
              <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-left border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase">{t.aiResultTitle}</span>
                  <CategoryBadge category={liveReport.category} />
                </div>
                <p className="text-sm font-medium text-slate-800">{liveReport.reason}</p>
                {liveReport.pothole_conf != null && liveReport.pothole_conf > 0 && (
                  <div className="text-xs text-slate-500 flex gap-4 pt-1">
                    <span>Confidence: {(liveReport.pothole_conf * 100).toFixed(0)}%</span>
                    <span>Count: {liveReport.pothole_count}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-2 flex items-center justify-center gap-2 text-xs text-slate-500">
                <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
                <span>{t.analyzing}</span>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <Link
              to="/map"
              className="block w-full py-3.5 bg-slate-900 text-white rounded-xl text-base font-semibold hover:bg-slate-800 transition"
            >
              {t.viewOnMap}
            </Link>
            <button
              className="w-full py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-medium transition"
              onClick={() => {
                setDone(null);
                setLiveReport(null);
                setFile(null);
                setPreview("");
              }}
            >
              {t.reportAnother}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setLang((l) => (l === "en" ? "hi" : "en"))}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
        >
          {t.langBtn}
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />

        <div className="space-y-2">
          {!preview ? (
            <button
              type="button"
              className="w-full py-8 border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-2xl flex flex-col items-center justify-center gap-2 transition"
              onClick={() => inputRef.current?.click()}
            >
              <span className="text-3xl">📷</span>
              <span className="text-base font-bold">{t.takePhoto}</span>
              <span className="text-xs text-slate-500">Tap to snap camera or upload file</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-64 flex items-center justify-center bg-black">
                <img src={preview} alt="preview" className="object-contain max-h-64 w-full" />
              </div>
              <button
                type="button"
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                onClick={() => inputRef.current?.click()}
              >
                {t.changePhoto}
              </button>
            </div>
          )}
        </div>

        {/* Location Section */}
        <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-200/80">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span className="flex items-center gap-1.5">
              <span>📍</span> {t.gpsSuccess}
            </span>
            <button
              type="button"
              onClick={() => setManualMode(!manualMode)}
              className="text-emerald-700 hover:underline font-bold"
            >
              {manualMode ? "Close manual" : "Edit / Pick city"}
            </button>
          </div>

          <div className="text-xs font-mono text-slate-700">
            {manualLat}, {manualLng}
            {accuracy != null && ` (±${Math.round(accuracy)}m)`}
          </div>

          {geoWarning && <p className="text-amber-800 text-xs bg-amber-50 p-2 rounded border border-amber-200">{geoWarning}</p>}

          {manualMode && (
            <div className="pt-2 border-t border-slate-200 space-y-2 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">{t.selectCity}:</label>
                <select
                  onChange={handleCitySelect}
                  className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  defaultValue="New Delhi"
                >
                  <option value="">-- Choose Indian City --</option>
                  {INDIAN_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.lat}, {c.lng})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 mb-0.5">{t.latitude}:</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualLat}
                    onChange={(e) => {
                      setManualLat(e.target.value);
                      setCoords({ lat: parseFloat(e.target.value), lng: parseFloat(manualLng) });
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-0.5">{t.longitude}:</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={manualLng}
                    onChange={(e) => {
                      setManualLng(e.target.value);
                      setCoords({ lat: parseFloat(manualLat), lng: parseFloat(e.target.value) });
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-xs bg-red-50 p-2 rounded border border-red-200">{error}</p>}

        <button
          type="submit"
          disabled={busy || !file}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-lg font-bold shadow transition"
        >
          {busy ? t.uploading : t.submit}
        </button>
      </form>
    </div>
  );
}
