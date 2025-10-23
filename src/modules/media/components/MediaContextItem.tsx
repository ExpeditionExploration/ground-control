import { ViewProps } from 'src/client/user-interface';
import { type MediaModuleClient } from '../client';
import { useEffect, useRef, useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { Tracks } from "./Tracks";

export const MediaContextItem: React.FC<ViewProps<MediaModuleClient>> = ({
    module,
}) => {

    return (
        <div className="absolute inset-0 w-full h-full">

        </div>
    );
};
