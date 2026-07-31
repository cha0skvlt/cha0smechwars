import { BALANCE } from '../config/balance.js';
import { Cam, W } from '../core/runtime.js';
import { Game } from '../game/Game.js';

export const AudioSys = {
    ctx: null, master: null, musicNode: null, concussionNode: null, filter: null, track: null,
    nextNoteTime: 0, noteIndex: 0, isPlaying: false, timerID: null,
    perfMs: 0,
    resetPerfTime: function() { this.perfMs = 0; },
    consumePerfTime: function() { const value = this.perfMs; this.perfMs = 0; return value; },
    recordPerfTime: function(startedAt) { this.perfMs += performance.now() - startedAt; },
    init: function() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.3;
        this.concussionNode = this.ctx.createBiquadFilter(); this.concussionNode.type = 'lowpass'; this.concussionNode.frequency.value = 22000;
        this.filter = this.ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 22000;
        this.musicNode = this.ctx.createGain(); this.musicNode.gain.value = 0.4;
        this.musicNode.connect(this.filter);
        this.filter.connect(this.concussionNode);
        this.concussionNode.connect(this.master);
        this.master.connect(this.ctx.destination);
    },
    updateFilter: function(hpPct) {
        if(!this.ctx) return;
        const startedAt = performance.now();
        const target = hpPct < 0.2 ? 200 : 22000;
        this.filter.frequency.setTargetAtTime(target, this.ctx.currentTime, 1.0);
        this.recordPerfTime(startedAt);
    },
    triggerConcussion: function() {
        if(!this.ctx) return;
        this.concussionNode.frequency.setValueAtTime(200, this.ctx.currentTime);
        this.concussionNode.frequency.exponentialRampToValueAtTime(22000, this.ctx.currentTime + 2.0);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.frequency.setValueAtTime(6000, this.ctx.currentTime);
        g.gain.setValueAtTime(0.05, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
        osc.connect(g); g.connect(this.master); osc.start(); osc.stop(this.ctx.currentTime + 1.5);
    },
    resume: function() { if(this.ctx && this.ctx.state==='suspended') this.ctx.resume(); },
    getPan: function(x) { if(!this.ctx || x==null) return 0; return Math.max(-1, Math.min(1, (x-Cam.x-W/2)/(W/2))); },
    playTone: function(freq, type, dur, vol=0.1, dest=null, x=null) {
        if(!this.ctx || !freq) return;
        const startedAt = performance.now();
        const t=this.ctx.currentTime, osc=this.ctx.createOscillator(), g=this.ctx.createGain();
        osc.type=type; osc.frequency.setValueAtTime(freq,t);
        if(x!==null) {
             osc.detune.value = (Math.random()-0.5)*200;
             const relX = x - (Game.player ? Game.player.x : Cam.x);
             if(Math.abs(relX) < 100) osc.frequency.linearRampToValueAtTime(freq*0.9, t+dur);
        }
        g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
        osc.connect(g);
        if(x !== null && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value=this.getPan(x); g.connect(p); p.connect(dest||this.filter); }
        else { g.connect(dest||this.filter); }
        osc.start(t); osc.stop(t+dur);
        this.recordPerfTime(startedAt);
    },
    playNoise: function(dur, vol=0.2, x=null) {
        if(!this.ctx) return;
        const startedAt = performance.now();
        const b=this.ctx.createBuffer(1,this.ctx.sampleRate*dur,this.ctx.sampleRate), d=b.getChannelData(0);
        for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
        const s=this.ctx.createBufferSource(); s.buffer=b; const g=this.ctx.createGain();
        g.gain.value=vol; g.gain.exponentialRampToValueAtTime(0.01,this.ctx.currentTime+dur);
        s.connect(g);
        if(x !== null && this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value=this.getPan(x); g.connect(p); p.connect(this.filter); }
        else { g.connect(this.filter); }
        s.start();
        this.recordPerfTime(startedAt);
    },
    shoot: function(w, x) {
        if(w==='pistol') this.playTone(800,'square',0.05,0.1, null, x);
        else if(w==='shotgun') { this.playNoise(0.2,0.3, x); this.playTone(100,'sawtooth',0.15, null, null, x); }
        else if(w==='mg') this.playTone(400,'square',0.04,0.1, null, x);
        else if(w==='rpg') {
            const f = BALANCE.WEAPONS.rpg.feel;
            // Triangle + short noise — quieter thump than legacy sawtooth blast
            this.playTone(90, 'triangle', f.shootToneDur, f.shootToneVol, null, x);
            this.playNoise(f.shootNoiseDur, f.shootNoiseVol, x);
        }
        else if(w==='laser') { this.playTone(1500,'sawtooth',0.1,0.1, null, x); this.playTone(200,'square',0.1,0.1, null, x); }
    },
    jetpack: function(x) { this.playNoise(0.15, 0.05, x); this.playTone(80, 'sawtooth', 0.15, 0.05, null, x); },
    dash: function(x) { this.playNoise(0.4, 0.2, x); this.playTone(60, 'sawtooth', 0.3, 0.2, null, x); },
    impact: function(x) { this.playNoise(0.4, 0.5, x); this.playTone(40, 'square', 0.3, 0.4, null, x); },
    // Quiet background tick for bullets hitting map props (narrow hear radius ~220px)
    obstacleHit: function(x, y) {
        if(!this.ctx) return;
        const startedAt = performance.now();
        const maxR = 220;
        let vol = 0.018;
        if(Game.player && x != null) {
            const px = Game.player.x + 16;
            const py = Game.player.y + 16;
            const d = Math.hypot(x - px, (y != null ? y : py) - py);
            if(d > maxR) {
                this.recordPerfTime(startedAt);
                return;
            }
            const t = 1 - d / maxR;
            vol *= t * t;
        }
        const t0 = this.ctx.currentTime;
        const noiseDur = 0.05;
        const b = this.ctx.createBuffer(1, Math.max(1, this.ctx.sampleRate * noiseDur), this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource(); src.buffer = b;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + noiseDur);
        src.connect(g);
        if(x != null && this.ctx.createStereoPanner) {
            const p = this.ctx.createStereoPanner();
            const center = Game.player ? Game.player.x + 16 : Cam.x + W / 2;
            p.pan.value = Math.max(-1, Math.min(1, (x - center) / 180));
            g.connect(p); p.connect(this.filter);
        } else {
            g.connect(this.filter);
        }
        src.start(t0);
        const osc = this.ctx.createOscillator(), og = this.ctx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(110, t0);
        og.gain.setValueAtTime(vol * 0.7, t0);
        og.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
        osc.connect(og); og.connect(this.filter);
        osc.start(t0); osc.stop(t0 + 0.04);
        this.recordPerfTime(startedAt);
    },
    boom: function(x) { this.playNoise(0.6,0.5, x); this.playTone(50,'triangle',0.7, null, null, x); },
    rpgBoom: function(x) {
        const f = BALANCE.WEAPONS.rpg.feel;
        this.playNoise(f.boomNoiseDur, f.boomNoiseVol, x);
        this.playTone(50, 'triangle', f.boomToneDur, f.boomToneVol, null, x);
    },
    power: function() { this.playTone(600,'sine',0.3); setTimeout(()=>this.playTone(1200,'sine',0.3),100); },
    // NEW SOUNDS FOR MODULES
    moduleDeploy: function() { this.playTone(300, 'square', 0.1); this.playTone(600, 'square', 0.1); },
    warpSound: function() { this.playTone(2000, 'sine', 0.5); this.playNoise(0.5, 0.2); },
    empSound: function() { this.playTone(100, 'sawtooth', 0.5); this.playNoise(0.2, 0.5); },
    gravSound: function() { this.playTone(50, 'sine', 1.0); },
    critHit: function() { this.playTone(1200, 'sine', 0.1, 0.2); setTimeout(() => this.playTone(1800, 'sine', 0.15, 0.15), 50); this.playNoise(0.1, 0.1); },

    startMusic: function(type) { if(this.track===type && this.isPlaying) return; this.stopMusic(); this.track=type; this.isPlaying=true; this.noteIndex=0; this.nextNoteTime=this.ctx.currentTime+0.1; this.scheduler(); },
    stopMusic: function() { this.isPlaying=false; this.track=null; clearTimeout(this.timerID); },
    scheduler: function() {
        if(!this.isPlaying) return;
        const bpm = 110; const lookahead = 0.1;
        while(this.nextNoteTime < this.ctx.currentTime + lookahead) {
            this.playStep(this.track, this.noteIndex);
            this.nextNoteTime += 60/bpm/4;
            this.noteIndex++;
        }
        this.timerID = setTimeout(()=>this.scheduler(), 25);
    },
    playStep: function(track, i) {
        const step = i%16; const t = this.nextNoteTime;
        if(Game.enemies.length > 5 && step%2!==0) {
             const b=this.ctx.createBuffer(1,this.ctx.sampleRate*0.02,this.ctx.sampleRate), d=b.getChannelData(0);
             for(let k=0;k<d.length;k++) d[k]=Math.random()*2-1;
             const s=this.ctx.createBufferSource(); s.buffer=b; const g=this.ctx.createGain();
             g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.02);
             const f=this.ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=10000;
             s.connect(f); f.connect(g); g.connect(this.musicNode); s.start(t);
        }
        if(step%4===0) {
            const osc=this.ctx.createOscillator(), g=this.ctx.createGain();
            osc.frequency.setValueAtTime(120, t); osc.frequency.exponentialRampToValueAtTime(0.01, t+0.2);
            g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.2);
            osc.connect(g); g.connect(this.musicNode); osc.start(t); osc.stop(t+0.2);
        }
        if(step%8===4) {
             const b=this.ctx.createBuffer(1,this.ctx.sampleRate*0.1,this.ctx.sampleRate), d=b.getChannelData(0);
             for(let k=0;k<d.length;k++) d[k]=Math.random()*2-1;
             const s=this.ctx.createBufferSource(); s.buffer=b; const g=this.ctx.createGain();
             g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.1);
             s.connect(g); g.connect(this.musicNode); s.start(t);
        }
        if(step%2===0) {
             const b=this.ctx.createBuffer(1,this.ctx.sampleRate*0.05,this.ctx.sampleRate), d=b.getChannelData(0);
             for(let k=0;k<d.length;k++) d[k]=(Math.random()*2-1)*0.5;
             const s=this.ctx.createBufferSource(); s.buffer=b; const g=this.ctx.createGain();
             g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.05);
             const f=this.ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=8000;
             s.connect(f); f.connect(g); g.connect(this.musicNode); s.start(t);
        }
        if(track==='game') {
             if(step%2===0) this.playTone(step<8?82.4:65.4, 'sawtooth', 0.2, 0.3, this.musicNode);
             if(step%4===2) this.playTone(164.8*2, 'sine', 0.4, 0.05, this.musicNode);
             if(step%8===6) this.playTone(196*2, 'sine', 0.4, 0.05, this.musicNode);
        } else if(track==='boss') {
             this.playTone(65.4, 'sawtooth', 0.1, 0.4, this.musicNode);
             if(step%4===0) this.playTone(174.6, 'square', 0.1, 0.1, this.musicNode);
        }
    }
};
