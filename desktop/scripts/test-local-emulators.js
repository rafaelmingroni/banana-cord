// The RTDB Node SDK ignores NO_PROXY for WebSockets. Only emulator loopback
// may connect directly; never change proxy behavior for remote destinations.
if(process.env.FIREBASE_DATABASE_EMULATOR_HOST){
  const ws=require('faye-websocket'),Base=ws.Client;
  ws.Client=class extends Base{
    constructor(url,protocols,options={}){
      const next={...options};if(/^ws:\/\/(127\.0\.0\.1|localhost):9000\//.test(url))delete next.proxy;
      super(url,protocols,next);
    }
  };
}
