import { useCallback, useEffect, useRef } from 'react';
import { EVENT_NAMES, tracking } from 'common/tools/tracking';
import { useUserStore } from 'stores/useUserStore';
import { useUiLayoutStore } from 'stores/useUiLayoutStore';
import { FRAME_LAYOUT_MOBILE } from 'constants/uiConstants';
import { getScriptInfo } from 'Api/lesson';
export { EVENT_NAMES } from 'common/tools/tracking';

const USER_STATE_DICT = {
  '未注册': 'guest',
  '已注册': 'user',
  '已付费': 'member',
};
export const useTracking = () => {
  const { frameLayout } = useUiLayoutStore((state) => state);
  const { userInfo } = useUserStore((state) => state);
  const identifyTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const prevUserInfoRef = useRef<string | undefined>(undefined);

  // Identify user when user info changes with debouncing and change detection
  useEffect(() => {
    // Clear previous timeout if exists
    if (identifyTimeoutRef.current) {
      clearTimeout(identifyTimeoutRef.current);
    }

    // Set debounced timeout
    identifyTimeoutRef.current = setTimeout(() => {
      try {
        const umami = window.umami;
        if (!umami) {
          return;
        }

        // Create a unique identifier for current state
        const currentState = JSON.stringify({
          user_id: userInfo?.user_id,
          name: userInfo?.name,
          state: userInfo?.state,
          language: userInfo?.language
        });

        // Only call identify if state actually changed
        if (currentState !== prevUserInfoRef.current) {
          // Build session data with only safe fields
          const sessionData: { nickname?: string; user_state?: string; language?: string } = {};
          if (userInfo?.name) sessionData.nickname = userInfo.name;
          if (userInfo?.state) sessionData.user_state = userInfo.state;
          if (userInfo?.language) sessionData.language = userInfo.language;

          // Identify user with their unique ID and session data
          if (userInfo?.user_id) {
            if (Object.keys(sessionData).length > 0) {
              umami.identify(userInfo.user_id, sessionData);
            } else {
              umami.identify(userInfo.user_id);
            }
          } else {
            // Clear identification if no user
            umami.identify(null);
          }

          // Update previous state reference
          prevUserInfoRef.current = currentState;
        }
      } catch {
        // Silently fail - tracking errors should not affect user experience
        // Uncomment for debugging: console.error('Umami identify error:', error);
      }
    }, 100); // 100ms debounce delay

    // Cleanup function
    return () => {
      if (identifyTimeoutRef.current) {
        clearTimeout(identifyTimeoutRef.current);
      }
    };
  }, [userInfo?.user_id, userInfo?.name, userInfo?.state, userInfo?.language]);

  const getEventBasicData = useCallback(() => {
    return {
      user_type: userInfo?.state ? USER_STATE_DICT[userInfo.state] : 'guest',
      user_id: userInfo?.user_id || 0,
      device: frameLayout === FRAME_LAYOUT_MOBILE ? 'H5' : 'Web',
    };
  }, [frameLayout, userInfo?.state, userInfo?.user_id]);

  const trackEvent = useCallback(async (eventName, eventData) => {
    try {
      const basicData = getEventBasicData();
      const data = {
        ...eventData,
        ...basicData
      };
      tracking(eventName, data);
    } catch { }
  }, [getEventBasicData]);


  const trackTrailProgress = useCallback(async (scriptId) => {
    try {
      const { data: scriptInfo } = await getScriptInfo(scriptId);

      // 是否体验课
      if (!scriptInfo?.is_trial_lesson) {
        return;
      }

      trackEvent(EVENT_NAMES.TRIAL_PROGRESS, {
        progress_no: scriptInfo.script_index,
        progress_desc: scriptInfo.script_name,
      });
    } catch { }
  }, [trackEvent]);

  return { trackEvent, trackTrailProgress, EVENT_NAMES };
};
