'use client';

import { cn } from '@/lib/utils';
import { DEFAULT_VOICE, voiceCategories, voiceOptions } from '@/lib/constants';
import type { VoiceSelectorProps } from '@/types';

type VoiceKey = keyof typeof voiceOptions;

const VoiceSelector = ({ value, onChange, disabled, className }: VoiceSelectorProps) => {
    const selected = value || DEFAULT_VOICE;

    return (
        <div className={cn('space-y-4', className)}>
            {(Object.keys(voiceCategories) as Array<keyof typeof voiceCategories>).map((category) => (
                <div key={category} className="space-y-2">
                    <p className="label capitalize">{category} voices</p>

                    <div className="voice-selector-options">
                        {voiceCategories[category].map((key) => {
                            const voice = voiceOptions[key as VoiceKey];
                            const isSelected = selected === key || selected === voice.id;

                            return (
                                <button
                                    type="button"
                                    key={key}
                                    disabled={disabled}
                                    aria-pressed={isSelected}
                                    onClick={() => onChange(key)}
                                    className={cn(
                                        'voice-selector-option text-center',
                                        isSelected
                                            ? 'voice-selector-option-selected'
                                            : 'voice-selector-option-default',
                                        disabled && 'voice-selector-option-disabled',
                                    )}
                                >
                                    <span className="flex flex-col items-center gap-1">
                                        <span className="font-semibold text-[#212a3b]">{voice.name}</span>
                                        <span className="text-xs leading-4 text-[#3d485e]">
                                            {voice.description}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default VoiceSelector;
