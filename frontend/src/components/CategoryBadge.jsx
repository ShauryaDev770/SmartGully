export default function CategoryBadge({ category }) {
  const styles = {
    red: "bg-red-600 text-white",
    yellow: "bg-yellow-400 text-slate-900",
    green: "bg-green-600 text-white",
  };
  const cls = styles[category] || "bg-slate-400 text-white";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${cls}`}>
      {category || "pending"}
    </span>
  );
}
