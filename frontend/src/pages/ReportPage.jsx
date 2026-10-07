import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createReport, fetchReport, geocodeAddress } from "../api.js";
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

const POPULAR_CITY_SUGGESTIONS = [
  "New Delhi",
  "Mumbai",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Jaipur",
  "Lucknow",
  "Noida",
  "Gurugram",
];

const I18N = {
  en: {
    title: "Report a Pothole",
    subtitle: "Capture damaged roads. Our AI triages severity for civic repair crews.",
    langBtn: "हिंदी",
    takePhoto: "Take a live photo",
    uploadPhoto: "Upload from device",
    changePhoto: "Change photo",
    captureShot: "Capture",
    closeCamera: "Cancel camera",
    cameraHint: "Allow camera access, then tap Capture.",
    cameraFallback: "Live camera unavailable. Opening the device camera picker instead.",
    selectedImage: "Photo selected",
    
    // GPS & Location Section
    locationTitle: "Location Details",
    modeGps: "Auto GPS",
    modeAddress: "Search Address / City",
    modeManual: "Exact Lat & Long",
    gpsAcquiring: "Acquiring GPS coordinates…",
    gpsSuccess: "GPS Location Locked",
    accuracy: "accuracy",
    gpsWeak: "GPS accuracy is worse than 100 m. You can still submit or refine with address.",
    gpsDenied: "GPS access denied or unavailable. Please search by address or enter coordinates below.",
    redetectGps: "Re-detect GPS",
    gpsLockedNote: "Coordinates acquired directly from device GPS.",
    
    // Address Search Section
    enterCityLabel: "City Name",
    enterCityPlaceholder: "e.g. New Delhi, Mumbai, Bengaluru",
    enterAddressLabel: "Current Address / Landmark / Street",
    enterAddressPlaceholder: "e.g. MG Road, Near Metro Station, Sector 18",
    convertAddressBtn: "Convert to Lat & Long",
    convertingAddress: "Converting via OpenStreetMap…",
    convertSuccess: "Address converted to coordinates!",
    convertMultipleFound: "Matches found. Select the most accurate:",
    convertError: "Could not find coordinates for this address in India. Please check spelling or add a nearby landmark.",
    fillCityOrAddress: "Please enter a city or address to convert.",
    quickSuggestions: "Quick city picks:",
    
    // Manual Coordinates Section
    exactCoordsHint: "Enter exact latitude and longitude directly if you already know them.",
    selectCityPreset: "Or pick an Indian city preset:",
    latitude: "Latitude",
    longitude: "Longitude",
    accuracyLabel: "GPS Accuracy (m)",
    
    // Active Location Banner
    activeLocation: "Active Location for Report",
    sourceGps: "Device GPS",
    sourceAddress: "OSM Geocoded",
    sourceManual: "Manual Coords",
    viewOnOsm: "Verify on Map",
    
    // Pre-Upload Deletion & Security
    deletePhoto: "Delete Photo",
    discardDraft: "Discard Photo",
    preUploadNotice: "Pre-upload deletion available. Once submitted, reports are permanently locked to prevent data manipulation.",
    recordLockedTitle: "Immutable Civic Record",
    recordLockedMsg: "This report has been uploaded and permanently registered for AI triage. Uploaded reports cannot be edited or deleted to prevent data manipulation.",

    submit: "Submit Report",
    uploading: "Uploading report…",
    errorNoFile: "Please take or choose a photo first.",
    errorNoCoords: "Please provide valid coordinates within India (Lat 6°-37° N, Lng 68°-98° E).",
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
    takePhoto: "लाइव फोटो खींचें",
    uploadPhoto: "डिवाइस से फोटो चुनें",
    changePhoto: "फोटो बदलें",
    captureShot: "कैप्चर करें",
    closeCamera: "कैमरा बंद करें",
    cameraHint: "कैमरा अनुमति दें, फिर कैप्चर दबाएँ।",
    cameraFallback: "लाइव कैमरा उपलब्ध नहीं है। डिवाइस कैमरा पिकर खुल रहा है।",
    selectedImage: "फोटो चुनी गई",
    
    // GPS & Location Section
    locationTitle: "लोकेशन विवरण",
    modeGps: "ऑटो GPS",
    modeAddress: "पता / शहर खोजें",
    modeManual: "अक्षांश व देशांतर",
    gpsAcquiring: "GPS लोकेशन प्राप्त की जा रही है…",
    gpsSuccess: "GPS लोकेशन प्राप्त हुई",
    accuracy: "सटीकता",
    gpsWeak: "GPS सटीकता 100 मीटर से कम है। आप फिर भी सबमिट कर सकते हैं या पते से सुधार सकते हैं।",
    gpsDenied: "GPS अनुमति अस्वीकृत या अनुपलब्ध है। कृपया नीचे पता खोजें या निर्देशांक दर्ज करें।",
    redetectGps: "GPS पुनः जांचें",
    gpsLockedNote: "डिवाइस GPS से सटीक निर्देशांक प्राप्त हुए।",
    
    // Address Search Section
    enterCityLabel: "शहर का नाम",
    enterCityPlaceholder: "जैसे नई दिल्ली, मुंबई, बेंगलुरु",
    enterAddressLabel: "वर्तमान पता / लैंडमार्क / सड़क",
    enterAddressPlaceholder: "जैसे एमजी रोड, मेट्रो स्टेशन के पास, सेक्टर 18",
    convertAddressBtn: "अक्षांश-देशांतर में बदलें",
    convertingAddress: "OpenStreetMap द्वारा बदला जा रहा है…",
    convertSuccess: "पता सफलतापूर्वक निर्देशांकों में बदला गया!",
    convertMultipleFound: "कई परिणाम मिले। सबसे सटीक चुनें:",
    convertError: "भारत में इस पते के निर्देशांक नहीं मिले। कृपया वर्तनी जांचें या नजदीकी लैंडमार्क लिखें।",
    fillCityOrAddress: "कृपया बदलने के लिए शहर या पता दर्ज करें।",
    quickSuggestions: "त्वरित शहर चयन:",
    
    // Manual Coordinates Section
    exactCoordsHint: "यदि आपको सटीक अक्षांश और देशांतर ज्ञात हैं, तो उन्हें सीधे यहाँ दर्ज करें।",
    selectCityPreset: "या प्रमुख भारतीय शहर चुनें:",
    latitude: "अक्षांश (Latitude)",
    longitude: "देशांतर (Longitude)",
    accuracyLabel: "GPS सटीकता (मीटर)",
    
    // Active Location Banner
    activeLocation: "रिपोर्ट के सक्रिय निर्देशांक",
    sourceGps: "डिवाइस GPS",
    sourceAddress: "OSM द्वारा परिवर्तित",
    sourceManual: "मैन्युअल इनपुट",
    viewOnOsm: "मानचित्र पर जांचें",
    
    // Pre-Upload Deletion & Security (Hindi)
    deletePhoto: "फोटो हटाएं",
    discardDraft: "फोटो रद्द करें",
    preUploadNotice: "अपलोड से पहले हटाने का विकल्प उपलब्ध है। सबमिट होने के बाद डेटा में छेड़छाड़ रोकने के लिए रिपोर्ट स्थायी रूप से लॉक हो जाती है।",
    recordLockedTitle: "स्थायी नागरिक रिकॉर्ड",
    recordLockedMsg: "यह रिपोर्ट AI जांच के लिए स्थायी रूप से दर्ज हो गई है। डेटा हेरफेर रोकने के लिए सबमिट रिपोर्ट को हटाया या बदला नहीं जा सकता।",

    submit: "शिकायत दर्ज करें",
    uploading: "अपलोड हो रहा है…",
    errorNoFile: "कृपया पहले एक फोटो लें या चुनें।",
    errorNoCoords: "कृपया भारत के भीतर मान्य निर्देशांक प्रदान करें (अक्षांश 6°-37° N, देशांतर 68°-98° E)।",
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
  const galleryRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [lang, setLang] = useState("en");
  const t = I18N[lang];

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  
  // Location States
  const [locationTab, setLocationTab] = useState("gps"); // "gps" | "address" | "manual"
  const [locationSource, setLocationSource] = useState("gps"); // "gps" | "address" | "manual"
  const [coords, setCoords] = useState(null);
  const [manualLat, setManualLat] = useState("28.613900");
  const [manualLng, setManualLng] = useState("77.209000");
  const [accuracy, setAccuracy] = useState(null);
  const [geoWarning, setGeoWarning] = useState("");
  const [gpsLocating, setGpsLocating] = useState(false);
  const [gpsLocked, setGpsLocked] = useState(false);

  // Address Geocoding States
  const [searchCity, setSearchCity] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState([]);
  const [selectedGeocode, setSelectedGeocode] = useState(null);
  const [geocodeError, setGeocodeError] = useState("");

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [liveReport, setLiveReport] = useState(null);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoWarning(t.gpsDenied);
      setLocationTab("address");
      return;
    }
    setGpsLocating(true);
    setGeoWarning("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = pos.coords.accuracy;
        setCoords({ lat, lng });
        setManualLat(lat.toFixed(6));
        setManualLng(lng.toFixed(6));
        setAccuracy(acc);
        setGpsLocating(false);
        setGpsLocked(true);
        setLocationSource("gps");
        if (acc > 100) {
          setGeoWarning(t.gpsWeak);
        } else {
          setGeoWarning("");
        }
      },
      () => {
        setGpsLocating(false);
        setGpsLocked(false);
        setGeoWarning(t.gpsDenied);
        // Switch to address search so citizen can easily type address
        setLocationTab("address");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const applyFile = (chosen) => {
    if (!chosen) return;
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    setDone(null);
    setLiveReport(null);
    setError("");
    requestLocation();
  };

  const deletePhoto = () => {
    if (preview && preview.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview("");
    setError("");
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const onFile = (e) => {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    applyFile(chosen);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  const openLiveCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t.cameraFallback);
      cameraInputRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setError(t.cameraFallback);
      cameraInputRef.current?.click();
    }
  };

  const captureShot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        applyFile(new File([blob], "live-photo.jpg", { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Handle Open-Source Geocoding Address & City to Lat/Lng
  const handleConvertAddress = async () => {
    if (!searchCity.trim() && !searchAddress.trim()) {
      setGeocodeError(t.fillCityOrAddress);
      return;
    }
    setGeocoding(true);
    setGeocodeError("");
    setGeocodeResults([]);

    try {
      const results = await geocodeAddress({
        address: searchAddress.trim(),
        city: searchCity.trim(),
      });

      if (!results || results.length === 0) {
        setGeocodeError(t.convertError);
        return;
      }

      setGeocodeResults(results);
      const topMatch = results[0];
      setSelectedGeocode(topMatch);
      setManualLat(topMatch.lat.toFixed(6));
      setManualLng(topMatch.lng.toFixed(6));
      setCoords({ lat: topMatch.lat, lng: topMatch.lng });
      setAccuracy(25);
      setLocationSource("address");
      setGeoWarning("");
    } catch (err) {
      console.error("Geocoding failed:", err);
      setGeocodeError(t.convertError);
    } finally {
      setGeocoding(false);
    }
  };

  const handleSelectGeocodeItem = (item) => {
    setSelectedGeocode(item);
    setManualLat(item.lat.toFixed(6));
    setManualLng(item.lng.toFixed(6));
    setCoords({ lat: item.lat, lng: item.lng });
    setAccuracy(20);
    setLocationSource("address");
  };

  const handleCitySelect = (e) => {
    const cityName = e.target.value;
    const city = INDIAN_CITIES.find((c) => c.name === cityName);
    if (city) {
      setManualLat(city.lat.toFixed(6));
      setManualLng(city.lng.toFixed(6));
      setCoords({ lat: city.lat, lng: city.lng });
      setAccuracy(50);
      setLocationSource("manual");
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

    if (
      isNaN(finalLat) ||
      isNaN(finalLng) ||
      finalLat < 6 ||
      finalLat > 37 ||
      finalLng < 68 ||
      finalLng > 98
    ) {
      setError(t.errorNoCoords);
      return;
    }

    setBusy(true);
    try {
      const result = await createReport({
        file,
        lat: finalLat,
        lng: finalLng,
        accuracy_m: accuracy || 20,
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

            {/* Immutable Record Notice */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <span>🔒</span>
                <span>{t.recordLockedTitle}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {t.recordLockedMsg}
              </p>
            </div>
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
      {/* Header */}
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
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />

        {/* Live Camera Modal */}
        {cameraOpen && (
          <div className="fixed inset-0 z-[2000] bg-black/80 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[3/4] object-cover bg-black"
              />
              <p className="text-xs text-slate-300 text-center px-4 pt-3">{t.cameraHint}</p>
              <div className="grid grid-cols-2 gap-3 p-4">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="py-3 rounded-xl bg-slate-700 text-white text-sm font-semibold"
                >
                  {t.closeCamera}
                </button>
                <button
                  type="button"
                  onClick={captureShot}
                  className="py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold"
                >
                  {t.captureShot}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Photo Selection Section */}
        <div className="space-y-2">
          {!preview ? (
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                className="w-full min-h-[88px] py-5 px-4 border-2 border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50 hover:bg-emerald-50 text-slate-800 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition"
                onClick={() => galleryRef.current?.click()}
              >
                <span className="text-3xl" aria-hidden>
                  🖼️
                </span>
                <span className="text-base font-bold">{t.uploadPhoto}</span>
                <span className="text-xs text-slate-500">JPEG or PNG from gallery</span>
              </button>
              <button
                type="button"
                className="w-full min-h-[88px] py-5 px-4 border-2 border-dashed border-slate-300 hover:border-sky-400 bg-slate-50 hover:bg-sky-50 text-slate-800 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition"
                onClick={openLiveCamera}
              >
                <span className="text-3xl" aria-hidden>
                  📷
                </span>
                <span className="text-base font-bold">{t.takePhoto}</span>
                <span className="text-xs text-slate-500">Use the rear camera when available</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-64 flex items-center justify-center bg-black">
                <img src={preview} alt="preview" className="object-contain max-h-64 w-full" />
                {/* Floating Delete Button (Available Only Before Uploading) */}
                <button
                  type="button"
                  onClick={deletePhoto}
                  className="absolute top-2.5 right-2.5 bg-red-600/90 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 backdrop-blur-sm cursor-pointer z-10"
                  title={t.deletePhoto}
                >
                  <span>🗑️</span>
                  <span>{t.deletePhoto}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs">
                <p className="font-semibold text-slate-600">{t.selectedImage}</p>
                {file && (
                  <span className="text-[11px] text-slate-400 font-medium">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold truncate px-1"
                  onClick={() => galleryRef.current?.click()}
                >
                  {t.uploadPhoto}
                </button>
                <button
                  type="button"
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold truncate px-1"
                  onClick={openLiveCamera}
                >
                  {t.takePhoto}
                </button>
                <button
                  type="button"
                  className="py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 truncate px-1"
                  onClick={deletePhoto}
                  title={t.deletePhoto}
                >
                  <span>🗑️</span>
                  <span>{t.deletePhoto}</span>
                </button>
              </div>

              {/* Pre-Upload Security & Anti-Manipulation Notice */}
              <div className="flex items-start gap-2 p-2.5 bg-slate-100/90 rounded-xl text-[11px] text-slate-600 border border-slate-200">
                <span className="text-xs shrink-0">🔒</span>
                <span className="leading-tight">{t.preUploadNotice}</span>
              </div>
            </div>
          )}
        </div>

        {/* Location Section */}
        <div className="p-4 bg-slate-50 rounded-2xl space-y-3.5 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
            <span className="flex items-center gap-1.5">
              <span className="text-base">📍</span> {t.locationTitle}
            </span>
            <span className="text-[11px] font-medium text-slate-500">
              India (6°-37° N, 68°-98° E)
            </span>
          </div>

          {/* Location Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLocationTab("gps")}
              className={`py-2 px-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                locationTab === "gps"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🛰️</span>
              <span className="truncate">{t.modeGps}</span>
            </button>
            <button
              type="button"
              onClick={() => setLocationTab("address")}
              className={`py-2 px-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                locationTab === "address"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🔍</span>
              <span className="truncate">{t.modeAddress}</span>
            </button>
            <button
              type="button"
              onClick={() => setLocationTab("manual")}
              className={`py-2 px-1.5 rounded-lg transition flex items-center justify-center gap-1 ${
                locationTab === "manual"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>✏️</span>
              <span className="truncate">{t.modeManual}</span>
            </button>
          </div>

          {/* TAB 1: Auto GPS */}
          {locationTab === "gps" && (
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    {gpsLocating ? (
                      <>
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                        <span>{t.gpsAcquiring}</span>
                      </>
                    ) : gpsLocked ? (
                      <>
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-emerald-700 font-bold">{t.gpsSuccess}</span>
                        {accuracy != null && (
                          <span className="text-slate-500 text-[11px] font-normal">
                            (±{Math.round(accuracy)}m {t.accuracy})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-600">GPS not acquired yet</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">{t.gpsLockedNote}</p>
                </div>

                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={gpsLocating}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs flex items-center gap-1 shrink-0 transition"
                >
                  <span>🔄</span>
                  <span>{t.redetectGps}</span>
                </button>
              </div>

              {geoWarning && (
                <div className="p-2.5 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 space-y-1">
                  <p className="font-medium">{geoWarning}</p>
                  <p className="text-[11px] text-amber-700">
                    Tip: Switch to <b>{t.modeAddress}</b> above to enter your street & city.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Address & City Converter (Open-Source Geocoder) */}
          {locationTab === "address" && (
            <div className="space-y-3 pt-1 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">{t.enterCityLabel}:</label>
                <input
                  type="text"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  placeholder={t.enterCityPlaceholder}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
                {/* Popular City Chips */}
                <div className="flex flex-wrap gap-1 pt-1 items-center">
                  <span className="text-[10px] text-slate-400 font-medium">{t.quickSuggestions}</span>
                  {POPULAR_CITY_SUGGESTIONS.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSearchCity(c)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
                        searchCity === c
                          ? "bg-emerald-100 border-emerald-400 text-emerald-800 font-semibold"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-700">{t.enterAddressLabel}:</label>
                <input
                  type="text"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConvertAddress();
                    }
                  }}
                  placeholder={t.enterAddressPlaceholder}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <button
                type="button"
                onClick={handleConvertAddress}
                disabled={geocoding || (!searchCity.trim() && !searchAddress.trim())}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition"
              >
                {geocoding ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>{t.convertingAddress}</span>
                  </>
                ) : (
                  <>
                    <span>🌍</span>
                    <span>{t.convertAddressBtn}</span>
                  </>
                )}
              </button>

              {geocodeError && (
                <div className="p-2.5 bg-red-50 text-red-700 rounded-xl border border-red-200">
                  {geocodeError}
                </div>
              )}

              {/* Resolved Geocode Confirmation & Matches */}
              {selectedGeocode && (
                <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between text-emerald-800 font-bold">
                    <span className="flex items-center gap-1">
                      <span>✓</span> {t.convertSuccess}
                    </span>
                    <span className="font-mono text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      {manualLat}, {manualLng}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-900 leading-relaxed font-medium">
                    {selectedGeocode.display_name}
                  </p>

                  {/* Multiple matches picker */}
                  {geocodeResults.length > 1 && (
                    <div className="pt-2 border-t border-emerald-200/80 space-y-1">
                      <span className="text-[11px] text-emerald-800 font-semibold">
                        {t.convertMultipleFound}
                      </span>
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {geocodeResults.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectGeocodeItem(item)}
                            className={`w-full text-left p-1.5 rounded text-[11px] transition truncate ${
                              selectedGeocode.lat === item.lat && selectedGeocode.lng === item.lng
                                ? "bg-emerald-600 text-white font-medium"
                                : "bg-white text-slate-700 hover:bg-emerald-100"
                            }`}
                          >
                            {item.display_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Exact Lat & Long Input */}
          {locationTab === "manual" && (
            <div className="space-y-3 pt-1 text-xs">
              <p className="text-slate-600 text-[11px]">{t.exactCoordsHint}</p>

              <div>
                <label className="block text-slate-600 mb-1">{t.selectCityPreset}</label>
                <select
                  onChange={handleCitySelect}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-800"
                  defaultValue=""
                >
                  <option value="">-- Choose Indian City Preset --</option>
                  {INDIAN_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.lat}, {c.lng})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">{t.latitude}:</label>
                  <input
                    type="number"
                    step="any"
                    value={manualLat}
                    onChange={(e) => {
                      setManualLat(e.target.value);
                      setLocationSource("manual");
                      setCoords({ lat: parseFloat(e.target.value) || 0, lng: parseFloat(manualLng) || 0 });
                    }}
                    placeholder="28.6139"
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">{t.longitude}:</label>
                  <input
                    type="number"
                    step="any"
                    value={manualLng}
                    onChange={(e) => {
                      setManualLng(e.target.value);
                      setLocationSource("manual");
                      setCoords({ lat: parseFloat(manualLat) || 0, lng: parseFloat(e.target.value) || 0 });
                    }}
                    placeholder="77.2090"
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Active Coordinates Banner (Visible Across All Tabs) */}
          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-600">{t.activeLocation}:</span>
              <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {manualLat}, {manualLng}
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                {locationSource === "gps" && `🛰️ ${t.sourceGps}`}
                {locationSource === "address" && `🌍 ${t.sourceAddress}`}
                {locationSource === "manual" && `✏️ ${t.sourceManual}`}
              </span>
            </div>

            <a
              href={`https://www.openstreetmap.org/?mlat=${manualLat}&mlon=${manualLng}#map=16/${manualLat}/${manualLng}`}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-700 hover:text-emerald-800 font-semibold text-[11px] underline shrink-0"
              title="Open coordinate location on OpenStreetMap"
            >
              {t.viewOnOsm} ↗
            </a>
          </div>
        </div>

        {error && <p className="text-red-600 text-xs bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>}

        <div className="flex items-center gap-2">
          {file && (
            <button
              type="button"
              onClick={deletePhoto}
              disabled={busy}
              className="py-4 px-4 bg-slate-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-600 border border-slate-200 rounded-xl text-sm font-semibold transition shrink-0 flex items-center gap-1.5 cursor-pointer"
              title={t.deletePhoto}
            >
              <span>🗑️</span>
              <span className="hidden sm:inline">{t.deletePhoto}</span>
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !file}
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-lg font-bold shadow transition"
          >
            {busy ? t.uploading : t.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
