import { useEffect, useState } from 'react';
import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react';

// Assume you have these from your player context / state
// (e.g. howler.js, HTMLAudioElement, zustand store, etc.)
interface VolumeButtonProps {
    volume: number;       // 0.0 → 1.0
    isMuted: boolean;
    canShowSlider: boolean;
    onVolumeChange: (newVolume: number) => void;
    onToggleMute: () => void;

}

export function VolumeButton({
    volume,
    isMuted,
    onVolumeChange,
    onToggleMute,
    canShowSlider
}: VolumeButtonProps) {

    const [displaySlider, setDisplaySlider] = useState(canShowSlider)

    useEffect( () => {
        setDisplaySlider(canShowSlider)
        console.log("chnage detected",canShowSlider)
    },[canShowSlider])

    // Choose icon based on volume level + mute
    const getVolumeIcon = () => {
        if (isMuted || volume === 0) return VolumeX;
        if (volume < 0.33) return Volume;
        if (volume < 0.66) return Volume1;
        return Volume2;
    };

    const VolumeIcon = getVolumeIcon();

    return (
        <div className=" relative flex items-center gap-2"
        onMouseEnter={() => setDisplaySlider(true)}
        >

            <div
                className='w h-min flex relative'
            >
                <button
                    onClick={onToggleMute}
                    className="p-2 rounded-full text-gray-400 transition"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                >
                    <VolumeIcon size={24} strokeWidth={2} className='hover:text-gray-300' />
                </button>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                        const newVol = Number(e.target.value);
                        onVolumeChange(newVol);
                        // Optional: unmute when dragging if was muted
                        if (isMuted && newVol > 0) onToggleMute();
                    }}
                    className={`volume-slider mt-[1.2rem] ${displaySlider ? 'w-20 opacity-100' : 'w-20 opacity-0'}`}
                />
            </div>
        </div >
    );
}