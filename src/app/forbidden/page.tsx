import Link from "next/link";
export default function Forbidden() {
  return <div className="grid min-h-screen place-items-center p-6"><div className="card max-w-md p-6 text-center"><h1 className="h1">Not permitted</h1><p className="muted mt-2">Your role does not include access to this page. Ask the Super Admin if you need it.</p><Link href="/" className="btn-primary mt-4">Back to home</Link></div></div>;
}
