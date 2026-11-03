import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, PanResponder, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppScreen, Eyebrow } from '@/components/ui';
import { colors, radii } from '@/theme/colors';
import { clearWhiteboard, createWhiteboard, generateTopicGuide, getWhiteboardEvents, sendWhiteboardStroke, type TopicGuide, type WhiteboardEvent, type WhiteboardRoom, type WhiteboardShape, type WhiteboardStroke } from '@/services/api';
import { useAuth } from '@/state/auth';

const palette = ['#153A34', '#B64436', '#D97706', '#31744D', '#377F9B', '#786B99'];
type DrawStroke = WhiteboardStroke & { id: number; author: string };
type ToolMode = 'pen' | 'eraser' | 'pan' | WhiteboardShape;
type BoardView = { zoom: number; offsetX: number; offsetY: number };
type BoardGesture = { nativeEvent: { locationX: number; locationY: number; touches?: readonly { locationX: number; locationY: number }[] } };
const shapeTools: { mode: WhiteboardShape; icon: ComponentProps<typeof Ionicons>['name']; label: string }[] = [
  { mode: 'line', icon: 'remove-outline', label: 'Line' },
  { mode: 'rectangle', icon: 'square-outline', label: 'Rectangle' },
  { mode: 'ellipse', icon: 'ellipse-outline', label: 'Oval' },
  { mode: 'triangle', icon: 'triangle-outline', label: 'Triangle' },
  { mode: 'arrow', icon: 'arrow-forward-outline', label: 'Arrow' },
];

export default function WhiteboardScreen() {
  const { code: initialCode } = useLocalSearchParams<{ code?: string }>();
  const { user } = useAuth();
  const [room, setRoom] = useState<WhiteboardRoom | null>(null);
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState(initialCode?.toUpperCase() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [syncError, setSyncError] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [shareStatus, setShareStatus] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previousOrientationLock = useRef<ScreenOrientation.OrientationLock | null>(null);
  const orientationBusy = useRef(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [guideTopic, setGuideTopic] = useState('');
  const [guideContext, setGuideContext] = useState('');
  const [guide, setGuide] = useState<TopicGuide | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const [guideError, setGuideError] = useState('');
  const guideController = useRef<AbortController | null>(null);
  const [color, setColor] = useState(palette[0]);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [toolMode, setToolMode] = useState<ToolMode>('pen');
  const [boardView, setBoardView] = useState<BoardView>({ zoom: 1, offsetX: 0, offsetY: 0 });
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [draft, setDraft] = useState<WhiteboardStroke | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const roomRef = useRef<WhiteboardRoom | null>(null);
  const cursorRef = useRef(0);
  const strokesRef = useRef<DrawStroke[]>([]);
  const seenIds = useRef(new Set<number>());
  const pendingStrokesRef = useRef(new Map<string, { roomCode: string; stroke: DrawStroke }>());
  const sendingStrokesRef = useRef(new Set<string>());
  const canvasSizeRef = useRef(canvasSize);
  const colorRef = useRef(color);
  const widthRef = useRef(strokeWidth);
  const toolRef = useRef(toolMode);
  const boardViewRef = useRef(boardView);
  const draftRef = useRef<WhiteboardStroke | null>(null);
  const gestureModeRef = useRef<'draw' | 'pan' | 'pinch' | null>(null);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number; anchorX: number; anchorY: number } | null>(null);

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { canvasSizeRef.current = canvasSize; }, [canvasSize]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { toolRef.current = toolMode; }, [toolMode]);
  useEffect(() => { boardViewRef.current = boardView; }, [boardView]);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const restoreScreenOrientation = useCallback(async () => {
    const previous = previousOrientationLock.current;
    previousOrientationLock.current = null;
    if (previous === null) return;
    try { await ScreenOrientation.lockAsync(previous); }
    catch { await ScreenOrientation.unlockAsync().catch(() => undefined); }
  }, []);

  useEffect(() => () => { void restoreScreenOrientation(); }, [restoreScreenOrientation]);

  useEffect(() => () => { guideController.current?.abort(); }, []);

  const toggleFullscreen = async () => {
    if (orientationBusy.current) return;
    orientationBusy.current = true;
    try {
      if (isFullscreen) {
        await restoreScreenOrientation();
        setIsFullscreen(false);
        return;
      }
      const previous = await ScreenOrientation.getOrientationLockAsync().catch(() => ScreenOrientation.OrientationLock.DEFAULT);
      const supported = await ScreenOrientation.supportsOrientationLockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => false);
      if (!supported) throw new Error('This device does not support landscape orientation locking.');
      previousOrientationLock.current = previous;
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsFullscreen(true);
    } catch (caught) {
      await restoreScreenOrientation();
      Alert.alert('Landscape mode unavailable', caught instanceof Error ? caught.message : 'Could not rotate the screen. Check that auto-rotate is enabled, then try again.');
    } finally {
      orientationBusy.current = false;
    }
  };

  const updateBoardView = useCallback((next: BoardView) => {
    boardViewRef.current = next;
    setBoardView(next);
  }, []);

  const confirmLocalStroke = useCallback((clientId: string, serverId: number) => {
    pendingStrokesRef.current.delete(clientId);
    sendingStrokesRef.current.delete(clientId);
    seenIds.current.add(serverId);
    const updated = strokesRef.current.map((stroke) => stroke.clientId === clientId ? { ...stroke, id: serverId } : stroke);
    strokesRef.current = updated;
    setStrokes(updated);
    setPendingCount(pendingStrokesRef.current.size);
    if (pendingStrokesRef.current.size === 0) setSyncError(false);
  }, []);

  const syncPendingStroke = useCallback(async (code: string, stroke: DrawStroke) => {
    const clientId = stroke.clientId;
    if (!clientId || sendingStrokesRef.current.has(clientId)) return;
    sendingStrokesRef.current.add(clientId);
    try {
      const result = await sendWhiteboardStroke(code, stroke);
      confirmLocalStroke(clientId, result.id);
    } catch {
      sendingStrokesRef.current.delete(clientId);
      if (pendingStrokesRef.current.has(clientId)) setSyncError(true);
    }
  }, [confirmLocalStroke]);

  const applyEvents = useCallback((events: WhiteboardEvent[]) => {
    let updated = strokesRef.current;
    for (const event of events) {
      cursorRef.current = Math.max(cursorRef.current, event.id);
      if (seenIds.current.has(event.id)) continue;
      seenIds.current.add(event.id);
      if (event.type === 'clear') updated = [];
      else {
        const stroke = event.data as WhiteboardStroke;
        const synchronized = { ...stroke, id: event.id, author: event.author };
        const localIndex = stroke.clientId ? updated.findIndex((item) => item.clientId === stroke.clientId) : -1;
        if (localIndex >= 0) updated = updated.map((item, index) => index === localIndex ? synchronized : item);
        else updated = [...updated, synchronized];
        if (stroke.clientId) {
          pendingStrokesRef.current.delete(stroke.clientId);
          sendingStrokesRef.current.delete(stroke.clientId);
        }
      }
    }
    strokesRef.current = updated;
    setStrokes(updated);
    setPendingCount(pendingStrokesRef.current.size);
  }, []);

  const openRoom = useCallback(async (nextRoom: WhiteboardRoom) => {
    const initial = await getWhiteboardEvents(nextRoom.code, 0);
    cursorRef.current = 0;
    strokesRef.current = [];
    seenIds.current = new Set<number>();
    setStrokes([]);
    applyEvents(initial.events);
    cursorRef.current = initial.cursor;
    setRoom(initial.room);
    const waitingHere = [...pendingStrokesRef.current.values()].filter((item) => item.roomCode === initial.room.code).map((item) => item.stroke);
    if (waitingHere.length) {
      const restored = [...strokesRef.current, ...waitingHere.filter((pending) => !strokesRef.current.some((item) => item.clientId === pending.clientId))];
      strokesRef.current = restored;
      setStrokes(restored);
    }
    setError('');
    setSyncError(false);
  }, [applyEvents]);

  useEffect(() => {
    if (!initialCode || room || !user) return;
    let active = true;
    void getWhiteboardEvents(initialCode.toUpperCase(), 0).then((initial) => {
      if (!active) return;
      cursorRef.current = 0;
      strokesRef.current = [];
      seenIds.current = new Set<number>();
      setStrokes([]);
      applyEvents(initial.events);
      cursorRef.current = initial.cursor;
      setRoom(initial.room);
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Could not join that room.'); });
    return () => { active = false; };
  }, [initialCode, room, user, applyEvents]);

  useEffect(() => {
    if (!room) return;
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await getWhiteboardEvents(room.code, cursorRef.current);
        if (!active) return;
        applyEvents(result.events);
        cursorRef.current = Math.max(cursorRef.current, result.cursor);
        setSyncError(false);
        for (const pending of pendingStrokesRef.current.values()) {
          if (pending.roomCode === room.code) void syncPendingStroke(room.code, pending.stroke);
        }
      } catch {
        if (active) setSyncError(true);
      }
      if (active) timeout = setTimeout(() => { void poll(); }, 1200);
    };
    timeout = setTimeout(() => { void poll(); }, 1200);
    return () => { active = false; clearTimeout(timeout); };
  }, [room, applyEvents, syncPendingStroke]);

  const createRoom = async () => {
    setBusy(true); setError('');
    try { await openRoom(await createWhiteboard(roomName.trim() || 'Study room')); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not create a room.'); }
    finally { setBusy(false); }
  };

  const joinRoom = async () => {
    const code = joinCode.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(code)) { setError('Enter the 8-character room code from your friend.'); return; }
    setBusy(true); setError('');
    try { await openRoom({ code, name: 'Study room' }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not join that room.'); }
    finally { setBusy(false); }
  };

  const pointFromGesture = (event: BoardGesture) => {
    const view = boardViewRef.current;
    return { x: view.offsetX + event.nativeEvent.locationX / view.zoom, y: view.offsetY + event.nativeEvent.locationY / view.zoom };
  };

  const appendStrokePoint = (event: BoardGesture) => {
    const current = draftRef.current;
    if (!current) return;
    const point = pointFromGesture(event);
    if (current.shape) {
      const next = { ...current, points: [current.points[0], point] };
      draftRef.current = next;
      setDraft(next);
      return;
    }
    const last = current.points[current.points.length - 1];
    const minDistance = 1.5 / boardViewRef.current.zoom;
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) return;
    let points = [...current.points, point];
    if (points.length > 1900) points = points.filter((_, index) => index % 2 === 0);
    const next = { ...current, points };
    draftRef.current = next;
    setDraft(next);
  };

  const startPinch = (event: BoardGesture) => {
    const touches = event.nativeEvent.touches ?? [];
    if (touches.length < 2) return;
    const [first, second] = touches;
    const midpointX = (first.locationX + second.locationX) / 2;
    const midpointY = (first.locationY + second.locationY) / 2;
    const view = boardViewRef.current;
    pinchRef.current = {
      distance: Math.max(1, Math.hypot(second.locationX - first.locationX, second.locationY - first.locationY)),
      zoom: view.zoom,
      anchorX: view.offsetX + midpointX / view.zoom,
      anchorY: view.offsetY + midpointY / view.zoom,
    };
    gestureModeRef.current = 'pinch';
    draftRef.current = null;
    setDraft(null);
  };

  const finishStroke = () => {
    const completed = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    const activeRoom = roomRef.current;
    if (!completed || !activeRoom) return;
    const clientId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const localStroke: DrawStroke = { ...completed, clientId, id: -(Date.now() * 1000 + Math.floor(Math.random() * 1000)), author: 'You' };
    const updated = [...strokesRef.current, localStroke];
    strokesRef.current = updated;
    setStrokes(updated);
    pendingStrokesRef.current.set(clientId, { roomCode: activeRoom.code, stroke: localStroke });
    setPendingCount(pendingStrokesRef.current.size);
    void syncPendingStroke(activeRoom.code, localStroke);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      if ((event.nativeEvent.touches?.length ?? 0) >= 2) { startPinch(event); return; }
      if (toolRef.current === 'pan') {
        gestureModeRef.current = 'pan';
        lastPanPointRef.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
        return;
      }
      gestureModeRef.current = 'draw';
      const zoom = boardViewRef.current.zoom;
      const screenWidth = toolRef.current === 'eraser' ? Math.max(24, widthRef.current * 3) : widthRef.current;
      const shape = isWhiteboardShape(toolRef.current) ? toolRef.current : undefined;
      const firstPoint = pointFromGesture(event);
      const next: WhiteboardStroke = {
        color: colorRef.current,
        width: screenWidth / zoom,
        mode: toolRef.current === 'eraser' ? 'eraser' : 'pen',
        ...(shape ? { shape } : {}),
        points: shape ? [firstPoint, firstPoint] : [firstPoint],
      };
      draftRef.current = next;
      setDraft(next);
    },
    onPanResponderStart: (event) => { if ((event.nativeEvent.touches?.length ?? 0) >= 2) startPinch(event); },
    onPanResponderMove: (event) => {
      const touches = event.nativeEvent.touches ?? [];
      if (touches.length >= 2) {
        if (gestureModeRef.current !== 'pinch') startPinch(event);
        const pinch = pinchRef.current;
        if (!pinch) return;
        const [first, second] = touches;
        const midpointX = (first.locationX + second.locationX) / 2;
        const midpointY = (first.locationY + second.locationY) / 2;
        const distance = Math.max(1, Math.hypot(second.locationX - first.locationX, second.locationY - first.locationY));
        const zoom = Math.max(0.2, Math.min(6, pinch.zoom * distance / pinch.distance));
        updateBoardView({ zoom, offsetX: pinch.anchorX - midpointX / zoom, offsetY: pinch.anchorY - midpointY / zoom });
        return;
      }
      if (gestureModeRef.current === 'pinch') return;
      if (gestureModeRef.current === 'pan') {
        const previous = lastPanPointRef.current;
        if (!previous) return;
        const next = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
        const view = boardViewRef.current;
        updateBoardView({ ...view, offsetX: view.offsetX - (next.x - previous.x) / view.zoom, offsetY: view.offsetY - (next.y - previous.y) / view.zoom });
        lastPanPointRef.current = next;
        return;
      }
      if (gestureModeRef.current === 'draw') appendStrokePoint(event);
    },
    onPanResponderRelease: (event) => {
      if (gestureModeRef.current === 'draw') { appendStrokePoint(event); void finishStroke(); }
      gestureModeRef.current = null;
      pinchRef.current = null;
      lastPanPointRef.current = null;
    },
    onPanResponderTerminate: () => {
      if (gestureModeRef.current === 'draw') void finishStroke();
      gestureModeRef.current = null;
      pinchRef.current = null;
      lastPanPointRef.current = null;
    },
  }), [updateBoardView]);

  const zoomBoard = (factor: number) => {
    const current = boardViewRef.current;
    const nextZoom = Math.max(0.2, Math.min(6, current.zoom * factor));
    const centerX = canvasSizeRef.current.width / 2;
    const centerY = canvasSizeRef.current.height / 2;
    const anchorX = current.offsetX + centerX / current.zoom;
    const anchorY = current.offsetY + centerY / current.zoom;
    updateBoardView({ zoom: nextZoom, offsetX: anchorX - centerX / nextZoom, offsetY: anchorY - centerY / nextZoom });
  };

  const resetBoardView = () => updateBoardView({ zoom: 1, offsetX: 0, offsetY: 0 });

  const clearBoard = () => Alert.alert('Clear this board?', 'This removes the drawing for everyone in the room.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear board', style: 'destructive', onPress: () => {
      const activeRoom = roomRef.current;
      if (!activeRoom) return;
      void clearWhiteboard(activeRoom.code).then(() => {
        return getWhiteboardEvents(activeRoom.code, cursorRef.current);
      }).then((result) => {
        applyEvents(result.events);
        cursorRef.current = Math.max(cursorRef.current, result.cursor);
      }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not clear the board.'));
    } },
  ]);

  const shareRoom = async () => {
    const message = `Join my SAMAJVED whiteboard “${room?.name}” with room code ${room?.code}.`;
    if (Platform.OS !== 'web') {
      await Share.share({ message });
      return;
    }
    try {
      const browser = navigator as Navigator & { share?: (data: { text: string }) => Promise<void>; clipboard?: Clipboard };
      if (browser.share) await browser.share({ text: message });
      else if (browser.clipboard?.writeText) {
        await browser.clipboard.writeText(message);
        setShareStatus('Invite copied to clipboard');
      } else {
        window.prompt('Copy this invite for your friends:', message);
      }
    } catch { setShareStatus('Copy the room code above to invite a friend'); }
  };

  const openGuide = () => {
    setGuideTopic(room?.name ?? '');
    setGuideContext('');
    setGuide(null);
    setGuideError('');
    setGuideVisible(true);
  };

  const createGuide = async () => {
    const topic = guideTopic.trim();
    if (topic.length < 2) { setGuideError('Enter a topic with at least two characters.'); return; }
    if (guideController.current) return;
    const controller = new AbortController();
    guideController.current = controller;
    setGuideLoading(true);
    setGuideError('');
    try { setGuide(await generateTopicGuide(topic, guideContext.trim(), controller.signal)); }
    catch (caught) { if (!controller.signal.aborted) setGuideError(caught instanceof Error ? caught.message : 'Gemini could not make a study guide. Try again.'); }
    finally { if (guideController.current === controller) guideController.current = null; setGuideLoading(false); }
  };

  const closeGuide = () => { guideController.current?.abort(); guideController.current = null; setGuideLoading(false); setGuideVisible(false); };

  if (!room) return <AppScreen style={styles.entryScreen}>
    <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={19} color={colors.ink} /><Text style={styles.backText}>Back to learning</Text></Pressable>
    <View style={styles.entryHero}><View style={styles.entryIcon}><Ionicons name="brush-outline" size={24} color={colors.purpleDark} /></View><Eyebrow color={colors.purpleDark}>STUDY TOGETHER</Eyebrow><Text style={styles.entryTitle}>Think it through together.</Text><Text style={styles.entryBody}>Open a shared whiteboard, invite your friends, and work through the tricky parts one sketch at a time.</Text></View>
    <View style={styles.entryCard}>
      <Text style={styles.fieldLabel}>Start a new room</Text>
      <TextInput accessibilityLabel="Question or topic for this room" value={roomName} onChangeText={setRoomName} placeholder="Question or topic to solve" placeholderTextColor={colors.muted} style={styles.textInput} maxLength={80} />
      <Pressable disabled={busy} onPress={() => void createRoom()} style={({ pressed }) => [styles.primaryButton, busy && styles.buttonDisabled, pressed && styles.pressed]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="add-circle-outline" size={19} color="#FFFFFF" /><Text style={styles.primaryButtonText}>Create a whiteboard</Text></>}
      </Pressable>
    </View>
    <View style={styles.separator}><View style={styles.separatorLine} /><Text style={styles.separatorText}>OR JOIN YOUR FRIENDS</Text><View style={styles.separatorLine} /></View>
    <View style={styles.entryCard}>
      <Text style={styles.fieldLabel}>Room code</Text>
      <TextInput accessibilityLabel="Eight-character whiteboard room code" value={joinCode} onChangeText={(value) => setJoinCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="8-character code" placeholderTextColor={colors.muted} autoCapitalize="characters" maxLength={8} style={[styles.textInput, styles.codeInput]} />
      <Pressable disabled={busy} onPress={() => void joinRoom()} style={({ pressed }) => [styles.secondaryButton, busy && styles.buttonDisabled, pressed && styles.pressed]}><Ionicons name="enter-outline" size={18} color={colors.purple} /><Text style={styles.secondaryButtonText}>Join room</Text></Pressable>
    </View>
    {error ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={17} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
  </AppScreen>;

  return <>
    <StatusBar style="dark" hidden={isFullscreen} />
    <AppScreen scroll={false} style={[styles.boardScreen, isFullscreen && styles.boardFullscreen]}>
    {!isFullscreen ? <View style={styles.boardHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="Leave this whiteboard" onPress={() => { setRoom(null); router.setParams({ code: '' }); }} style={styles.backIcon}><Ionicons name="arrow-back" size={19} color={colors.ink} /></Pressable>
      <View style={styles.roomTitleWrap}><Eyebrow color={colors.purple}>SHARED WHITEBOARD</Eyebrow><Text style={styles.roomTitle} numberOfLines={1}>{room.name}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Generate a Gemini study guide" onPress={openGuide} style={styles.shareButton}><Ionicons name="sparkles-outline" size={18} color={colors.purple} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Share room invite" onPress={() => void shareRoom()} style={styles.shareButton}><Ionicons name="share-social-outline" size={18} color={colors.purple} /></Pressable>
    </View> : null}

    {!isFullscreen ? <View style={styles.roomCode}><View style={styles.roomCodeIcon}><Ionicons name="people-outline" size={17} color={colors.success} /></View><View style={{ flex: 1 }}><Text style={styles.roomCodeLabel}>INVITE FRIENDS WITH THIS CODE</Text><Text style={styles.roomCodeValue}>{room.code}</Text></View><View style={styles.liveState}><View style={[styles.liveDot, syncError && styles.offlineDot]} /><Text style={styles.liveText}>{syncError ? 'Reconnecting' : 'Live'}</Text></View></View> : null}

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarScroll}>
      <View style={styles.toolbar}>
        {palette.map((choice) => <Pressable key={choice} accessibilityRole="button" accessibilityLabel={`Pen color ${choice}`} accessibilityState={{ selected: color === choice && toolMode === 'pen' }} onPress={() => { setColor(choice); setToolMode('pen'); }} style={[styles.colorButton, color === choice && toolMode === 'pen' && styles.colorButtonSelected]}><View style={[styles.colorDot, { backgroundColor: choice }]} /></Pressable>)}
        <View style={styles.toolDivider} />
        <Pressable accessibilityRole="button" accessibilityLabel="Pen" accessibilityState={{ selected: toolMode === 'pen' }} onPress={() => setToolMode('pen')} style={[styles.modeButton, toolMode === 'pen' && styles.modeButtonSelected]}><Ionicons name="brush-outline" size={17} color={toolMode === 'pen' ? colors.purple : colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Eraser" accessibilityState={{ selected: toolMode === 'eraser' }} onPress={() => setToolMode('eraser')} style={[styles.modeButton, toolMode === 'eraser' && styles.modeButtonSelected]}><View style={[styles.eraserIcon, toolMode === 'eraser' && styles.eraserIconSelected]}><View style={styles.eraserSeam} /></View></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Move canvas" accessibilityState={{ selected: toolMode === 'pan' }} onPress={() => setToolMode('pan')} style={[styles.modeButton, toolMode === 'pan' && styles.modeButtonSelected]}><Ionicons name="hand-left-outline" size={17} color={toolMode === 'pan' ? colors.purple : colors.ink} /></Pressable>
        <View style={styles.toolDivider} />
        {shapeTools.map((tool) => <Pressable key={tool.mode} accessibilityRole="button" accessibilityLabel={tool.label} accessibilityState={{ selected: toolMode === tool.mode }} onPress={() => setToolMode(tool.mode)} style={[styles.modeButton, toolMode === tool.mode && styles.modeButtonSelected]}><Ionicons name={tool.icon} size={18} color={toolMode === tool.mode ? colors.purple : colors.ink} /></Pressable>)}
        <View style={styles.toolDivider} />
        {[3, 6, 10].map((size) => <Pressable key={size} accessibilityRole="button" accessibilityLabel={`${size} pixel pen`} accessibilityState={{ selected: strokeWidth === size }} onPress={() => setStrokeWidth(size)} style={[styles.sizeButton, strokeWidth === size && styles.sizeButtonSelected]}><View style={{ width: size + 2, height: size + 2, borderRadius: 9, backgroundColor: colors.ink }} /></Pressable>)}
        <View style={styles.toolDivider} />
        <Pressable accessibilityRole="button" accessibilityLabel="Generate a Gemini study guide" onPress={openGuide} style={styles.guideButton}><Ionicons name="sparkles-outline" size={17} color={colors.purple} /><Text style={styles.guideButtonText}>Study guide</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear whiteboard" onPress={clearBoard} style={styles.clearButton}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={isFullscreen ? 'Exit full screen' : 'Enter full screen'} accessibilityState={{ selected: isFullscreen }} onPress={() => { void toggleFullscreen(); }} style={[styles.modeButton, isFullscreen && styles.modeButtonSelected]}><Ionicons name={isFullscreen ? 'contract-outline' : 'expand-outline'} size={18} color={isFullscreen ? colors.purple : colors.ink} /></Pressable>
      </View>
    </ScrollView>

    {!isFullscreen ? <View style={styles.zoomToolbar}>
      <Text numberOfLines={1} style={styles.zoomHint}>{toolMode === 'eraser' ? 'Eraser active · switch to pen to draw' : toolMode === 'pan' ? 'Drag to move · pinch to zoom' : isWhiteboardShape(toolMode) ? `Drag to draw ${shapeTools.find((tool) => tool.mode === toolMode)?.label.toLowerCase() ?? 'a shape'}` : 'Pinch to zoom · select hand to move'}</Text>
      <View style={styles.zoomControls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => zoomBoard(1 / 1.25)} style={styles.zoomButton}><Ionicons name="remove" size={18} color={colors.ink} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset zoom" onPress={resetBoardView} style={styles.zoomValue}><Text style={styles.zoomValueText}>{Math.round(boardView.zoom * 100)}%</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => zoomBoard(1.25)} style={styles.zoomButton}><Ionicons name="add" size={18} color={colors.ink} /></Pressable>
      </View>
    </View> : null}

    <View style={[styles.canvasWrap, isFullscreen && styles.canvasWrapFullscreen]}>
      <View style={[styles.canvas, isFullscreen && styles.canvasFullscreen]} onLayout={(event) => setCanvasSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} {...panResponder.panHandlers}>
        <Svg pointerEvents="none" width="100%" height="100%" viewBox={`${boardView.offsetX} ${boardView.offsetY} ${canvasSize.width / boardView.zoom} ${canvasSize.height / boardView.zoom}`}>
          <Defs><Pattern id="whiteboard-grid" width="28" height="28" patternUnits="userSpaceOnUse"><Circle cx="1.5" cy="1.5" r="1.1" fill="#DDE6DF" /></Pattern></Defs>
          <Rect x={boardView.offsetX} y={boardView.offsetY} width={canvasSize.width / boardView.zoom} height={canvasSize.height / boardView.zoom} fill="url(#whiteboard-grid)" />
          {strokes.map((stroke) => <Path key={stroke.id} d={strokePath(stroke, canvasSize.width, canvasSize.height)} fill="none" stroke={stroke.mode === 'eraser' ? '#FFFFFF' : stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />)}
          {draft ? <Path d={strokePath(draft, canvasSize.width, canvasSize.height)} fill="none" stroke={draft.mode === 'eraser' ? '#FFFFFF' : draft.color} strokeWidth={draft.width} strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
        {!strokes.length && !draft ? <View pointerEvents="none" style={styles.canvasHint}><Ionicons name="hand-left-outline" size={20} color={colors.muted} /><Text style={styles.canvasHintText}>Draw with the pen or add a shape · pinch to zoom</Text></View> : null}
      </View>
    </View>
    {!isFullscreen ? <View style={styles.bottomHint}><Ionicons name={error ? 'alert-circle-outline' : shareStatus ? 'checkmark-circle-outline' : syncError ? 'cloud-offline-outline' : pendingCount ? 'cloud-upload-outline' : 'cloud-done-outline'} size={15} color={error || syncError ? colors.danger : colors.success} /><Text style={[styles.bottomHintText, (error || syncError) && styles.bottomError]}>{error || shareStatus || (syncError ? 'Paint stays on this device and will sync when connection returns' : pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'stroke' : 'strokes'} on this device · syncing` : `${strokes.length} ${strokes.length === 1 ? 'stroke' : 'strokes'} synced · pan anywhere to keep working`)}</Text></View> : null}
    </AppScreen>

    <Modal visible={guideVisible} transparent animationType="slide" onRequestClose={closeGuide}>
      <View style={styles.guideBackdrop}>
        <View style={styles.guideSheet}>
          <View style={styles.guideHeader}>
            <View style={styles.guideHeadingGroup}><View style={styles.guideIcon}><Ionicons name="sparkles-outline" size={19} color={colors.purple} /></View><View><Eyebrow color={colors.purple}>GEMINI STUDY GUIDE</Eyebrow><Text style={styles.guideTitle}>Explore this topic</Text></View></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close study guide" onPress={closeGuide} style={styles.guideClose}><Ionicons name="close" size={21} color={colors.ink} /></Pressable>
          </View>
          <TextInput value={guideTopic} onChangeText={setGuideTopic} placeholder="Enter a topic to explore" placeholderTextColor={colors.muted} style={styles.guideInput} maxLength={160} returnKeyType="go" onSubmitEditing={() => void createGuide()} />
          <TextInput value={guideContext} onChangeText={setGuideContext} placeholder="Add class, chapter, or notes for a more relevant guide (optional)" placeholderTextColor={colors.muted} style={[styles.guideInput, styles.guideContext]} multiline maxLength={2400} editable={!guideLoading} />
          <View style={styles.guideActions}><Pressable disabled={guideLoading} onPress={() => void createGuide()} style={({ pressed }) => [styles.guideGenerate, guideLoading && styles.buttonDisabled, pressed && styles.pressed]}>
            {guideLoading ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="sparkles" size={17} color="#FFFFFF" /><Text style={styles.primaryButtonText}>{guide ? 'Refresh study guide' : 'Generate with Gemini'}</Text></>}
          </Pressable>{guideLoading ? <Pressable accessibilityRole="button" onPress={() => { guideController.current?.abort(); guideController.current = null; setGuideLoading(false); setGuideError('Generation cancelled. You can retry when ready.'); }} style={styles.guideCancel}><Text style={styles.guideCancelText}>Cancel</Text></Pressable> : null}</View>
          {guideError ? <View style={styles.guideError}><Ionicons name="alert-circle-outline" size={17} color={colors.danger} /><Text style={styles.errorText}>{guideError}</Text></View> : null}
          {guide ? <ScrollView style={styles.guideResults} showsVerticalScrollIndicator={false} contentContainerStyle={styles.guideResultContent}>
            <GuideSection title="Overview" icon="book-outline"><Text style={styles.guideBody}>{guide.summary}</Text></GuideSection>
            <GuideSection title="Key ideas" icon="bulb-outline"><GuideBullets items={guide.keyIdeas} /></GuideSection>
            <GuideSection title="Related details" icon="git-branch-outline"><GuideBullets items={guide.relatedDetails} /></GuideSection>
            {guide.vocabulary.length ? <GuideSection title="Vocabulary" icon="reader-outline">{guide.vocabulary.map((item, index) => <View key={`${item.term}-${index}`} style={styles.vocabularyRow}><Text style={styles.vocabularyTerm}>{item.term}</Text><Text style={styles.guideBody}>{item.definition}</Text></View>)}</GuideSection> : null}
            {guide.example ? <GuideSection title="Example" icon="flask-outline"><Text style={styles.guideBody}>{guide.example}</Text></GuideSection> : null}
            {guide.studyQuestions.length ? <GuideSection title="Check your understanding" icon="help-circle-outline"><GuideBullets items={guide.studyQuestions} /></GuideSection> : null}
            <GuideSection title="Original study lyrics" icon="musical-notes-outline"><Text style={styles.guideLyrics}>{guide.lyrics}</Text><Text style={styles.guideFootnote}>AI-written lyrics for this topic. Check key facts against your class material.</Text></GuideSection>
          </ScrollView> : <View style={styles.guideEmpty}><Ionicons name="sparkles-outline" size={23} color={colors.muted} /><Text style={styles.guideEmptyText}>Get a topic overview, key ideas, related details, vocabulary, an example, review questions, and original study lyrics.</Text></View>}
        </View>
      </View>
    </Modal>
  </>;
}

function GuideSection({ title, icon, children }: { title: string; icon: ComponentProps<typeof Ionicons>['name']; children: ReactNode }) {
  return <View style={styles.guideCard}><View style={styles.guideSectionTitle}><Ionicons name={icon} size={17} color={colors.purple} /><Text style={styles.guideSectionLabel}>{title}</Text></View>{children}</View>;
}

function GuideBullets({ items }: { items: string[] }) {
  return <View style={styles.guideBulletList}>{items.map((item, index) => <View key={`${index}-${item.slice(0, 16)}`} style={styles.guideBulletRow}><View style={styles.guideBullet} /><Text style={[styles.guideBody, styles.guideBulletText]}>{item}</Text></View>)}</View>;
}

function isWhiteboardShape(mode: ToolMode): mode is WhiteboardShape {
  return shapeTools.some((tool) => tool.mode === mode);
}

function shapePath(shape: WhiteboardShape, points: { x: number; y: number }[]) {
  const [start, end] = points;
  if (!start || !end) return '';
  if (shape === 'line') return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  if (shape === 'rectangle') {
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const right = Math.max(start.x, end.x);
    const bottom = Math.max(start.y, end.y);
    return `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
  }
  if (shape === 'ellipse') {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const curve = 0.5522847498;
    return `M ${cx - rx} ${cy} C ${cx - rx} ${cy - curve * ry} ${cx - curve * rx} ${cy - ry} ${cx} ${cy - ry} C ${cx + curve * rx} ${cy - ry} ${cx + rx} ${cy - curve * ry} ${cx + rx} ${cy} C ${cx + rx} ${cy + curve * ry} ${cx + curve * rx} ${cy + ry} ${cx} ${cy + ry} C ${cx - curve * rx} ${cy + ry} ${cx - rx} ${cy + curve * ry} ${cx - rx} ${cy} Z`;
  }
  if (shape === 'triangle') {
    const middle = (start.x + end.x) / 2;
    return `M ${middle} ${start.y} L ${end.x} ${end.y} L ${start.x} ${end.y} Z`;
  }
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  if (distance < 0.01) return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = Math.min(Math.max(10, distance * 0.24), distance * 0.45);
  const wing = Math.PI / 6;
  const first = { x: end.x - headLength * Math.cos(angle - wing), y: end.y - headLength * Math.sin(angle - wing) };
  const second = { x: end.x - headLength * Math.cos(angle + wing), y: end.y - headLength * Math.sin(angle + wing) };
  return `M ${start.x} ${start.y} L ${end.x} ${end.y} M ${end.x} ${end.y} L ${first.x} ${first.y} M ${end.x} ${end.y} L ${second.x} ${second.y}`;
}

function strokePath(stroke: WhiteboardStroke, viewportWidth: number, viewportHeight: number) {
  if (!stroke.points.length) return '';
  const points = stroke.mode ? stroke.points : stroke.points.map((point) => ({ x: point.x * viewportWidth, y: point.y * viewportHeight }));
  if (stroke.shape) return shapePath(stroke.shape, points);
  const [first] = points;
  const start = `${first.x} ${first.y}`;
  if (points.length === 1) return `M ${start} L ${start}`;
  const path = [`M ${start}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 2)];
    const control1 = { x: from.x + (to.x - previous.x) / 6, y: from.y + (to.y - previous.y) / 6 };
    const control2 = { x: to.x - (next.x - from.x) / 6, y: to.y - (next.y - from.y) / 6 };
    path.push(`C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${to.x} ${to.y}`);
  }
  return path.join(' ');
}

const styles = StyleSheet.create({
  entryScreen: { flexGrow: 1, paddingBottom: 35, gap: 22 },
  back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 2 },
  backText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  entryHero: { gap: 9 },
  entryIcon: { width: 53, height: 53, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple, marginBottom: 4 },
  entryTitle: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.9 },
  entryBody: { color: colors.muted, fontSize: 13, lineHeight: 20, maxWidth: 420 },
  entryCard: { padding: 17, gap: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  textInput: { minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, color: colors.ink, fontSize: 14, backgroundColor: colors.canvas },
  codeInput: { fontSize: 16, letterSpacing: 2, fontWeight: '900' },
  primaryButton: { minHeight: 52, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: colors.purple },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  secondaryButton: { minHeight: 52, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, borderWidth: 1, borderColor: '#B8D4C9', backgroundColor: colors.softPurple },
  secondaryButtonText: { color: colors.purpleDark, fontSize: 13, fontWeight: '900' },
  buttonDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.84 },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 13, backgroundColor: '#FFF0EE' },
  errorText: { flex: 1, color: colors.danger, fontSize: 12, lineHeight: 17 },
  boardScreen: { flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 17, gap: 11 },
  boardFullscreen: { width: '100%', maxWidth: '100%', alignSelf: 'stretch', paddingHorizontal: 7, paddingTop: 5, paddingBottom: 5, gap: 6 },
  boardHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11 },
  backIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  roomTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  roomTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  shareButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softPurple },
  roomCode: { minHeight: 68, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: '#CFE2D5', borderRadius: 17, backgroundColor: '#F1F8F1' },
  roomCodeIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#E3F0E2' },
  roomCodeLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  roomCodeValue: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: 2.2, marginTop: 2 },
  liveState: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  offlineDot: { backgroundColor: colors.danger },
  liveText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  toolbarScroll: { minHeight: 52 },
  toolbar: { minHeight: 50, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  colorButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  colorButtonSelected: { borderWidth: 1.5, borderColor: colors.purple },
  colorDot: { width: 16, height: 16, borderRadius: 8 },
  toolDivider: { width: 1, height: 25, backgroundColor: colors.border },
  modeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  modeButtonSelected: { backgroundColor: colors.softPurple },
  eraserIcon: { width: 20, height: 13, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#9A7384', backgroundColor: '#F7DDE7', transform: [{ rotate: '-45deg' }] },
  eraserIconSelected: { borderColor: colors.purple },
  eraserSeam: { width: 1, height: 10, backgroundColor: '#9A7384' },
  sizeButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  sizeButtonSelected: { backgroundColor: colors.softPurple },
  guideButton: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, backgroundColor: colors.softPurple },
  guideButtonText: { color: colors.purpleDark, fontSize: 11, fontWeight: '800' },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFF1EF' },
  zoomToolbar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingHorizontal: 3 },
  zoomHint: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  zoomControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  zoomButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  zoomValue: { minWidth: 48, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  zoomValueText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
  canvasWrap: { flex: 1, minHeight: 170, padding: 1, borderRadius: 18, borderWidth: 1, borderColor: '#DEDBE8', backgroundColor: colors.surface },
  canvasWrapFullscreen: { borderRadius: 10 },
  canvas: { flex: 1, overflow: 'hidden', borderRadius: 17, backgroundColor: '#FFFFFF', touchAction: 'none' as never },
  canvasFullscreen: { borderRadius: 9 },
  canvasHint: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 9 },
  canvasHintText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  bottomHint: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  bottomHintText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  bottomError: { color: colors.danger },
  guideBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12, 31, 27, 0.46)' },
  guideSheet: { width: '100%', maxHeight: '94%', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 22, gap: 12, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.canvas },
  guideHeader: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  guideHeadingGroup: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  guideIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.softPurple },
  guideTitle: { marginTop: 2, color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.35 },
  guideClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  guideInput: { minHeight: 49, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink, fontSize: 14 },
  guideContext: { minHeight: 76, maxHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  guideActions: { flexDirection: 'row', gap: 9 },
  guideGenerate: { minHeight: 48, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: colors.purple },
  guideCancel: { minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  guideCancelText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  guideError: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 13, backgroundColor: '#FFF0EE' },
  guideEmpty: { minHeight: 132, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  guideEmptyText: { maxWidth: 350, color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'center' },
  guideResults: { flexGrow: 0, flexShrink: 1, minHeight: 130 },
  guideResultContent: { gap: 10, paddingBottom: 10 },
  guideCard: { padding: 14, gap: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  guideSectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guideSectionLabel: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  guideBody: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  guideBulletList: { gap: 8 },
  guideBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  guideBullet: { width: 6, height: 6, marginTop: 7, borderRadius: 3, backgroundColor: colors.mint },
  guideBulletText: { flex: 1 },
  vocabularyRow: { gap: 3 },
  vocabularyTerm: { color: colors.purpleDark, fontSize: 12, fontWeight: '900' },
  guideLyrics: { color: colors.ink, fontSize: 13, lineHeight: 22, fontWeight: '700' },
  guideFootnote: { color: colors.muted, fontSize: 10, lineHeight: 15 },
});
