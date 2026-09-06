import type { Metadata } from 'next';
import './globals.css';
import './workspace.css';
export const metadata: Metadata = {title:'Supervision Circle',description:'Find a good time for your monthly supervision meeting.',robots:{index:false,follow:false},referrer:'no-referrer',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
