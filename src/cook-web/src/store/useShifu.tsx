'use client';

import {
  Shifu,
  ShifuContextType,
  Outline,
  Block,
  ProfileItem,
  SaveBlockListResult,
  ApiResponse,
  ReorderOutlineItemDto,
  BlockDTO,
  BlockType,
  SaveMdflowPayload,
  LessonCreationSettings,
} from '../types/shifu';
import api from '@/api';
import { debounce } from 'lodash';
import {
  createContext,
  ReactNode,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react';
import { LEARNING_PERMISSION } from '@/c-api/studyV2';
import {
  getStoredPreviewVariables,
  mapKeysToStoredVariables,
  PreviewVariablesMap,
  savePreviewVariables,
  StoredVariablesByScope,
} from '@/components/lesson-preview/variableStorage';
import { useTracking } from '@/c-common/hooks/useTracking';

const ShifuContext = createContext<ShifuContextType | undefined>(undefined);


export const ShifuProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { trackEvent } = useTracking();
  const [currentShifu, setCurrentShifu] = useState<Shifu | null>(null);
  const [chapters, setChapters] = useState<Outline[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState('');
  const [focusValue, setFocusValue] = useState('');
  const [cataData, setCataData] = useState<{ [x: string]: Outline }>({});
  const [blocks, setBlocks] = useState<BlockDTO[]>([]);
  const [currentNode, setCurrentNode] = useState<Outline | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [mdflow, setMdflow] = useState<string>('');
  const [variables, setVariables] = useState<string[]>([]);
  const currentMdflow = useRef<string>('');
  const [systemVariables, setSystemVariables] = useState<
    Record<string, string>[]
  >([]);
  // Debounced autosave for mdflow; kept stable via ref
  const debouncedAutoSaveRef = useRef(
    debounce(async (payload?: SaveMdflowPayload) => {
      await saveMdflow(payload);
    }, 3000),
  );

  // Ensure UI types and content types are fetched only in the client environment
  // const UITypes = useUITypes()

  const loadShifu = async (
    shifuId: string,
    options?: {
      silent?: boolean;
    },
  ) => {
    const silent = options?.silent ?? false;

    try {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      const shifu = await api.getShifuDetail({
        shifu_bid: shifuId,
      });
      setCurrentShifu(shifu);
    } catch (error) {
      console.error(error);
      setError('Failed to load shifu');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };
  const recursiveCataData = (cataTree: Outline[]): any => {
    const result: any = {};
    const processItem = (item: any, parentId = '', depth = 0) => {
      result[item.id] = {
        ...cataData[item.id],
        parent_bid: parentId,
        parentId: parentId,
        name: item.name,
        type: item.type,
        is_hidden: item.is_hidden,
        depth: depth,
        status: 'edit',
      };

      if (item.children) {
        item.children.forEach((child: any) => {
          processItem(child, item.bid, depth + 1);
        });
      }
    };

    cataTree.forEach((child: any) => {
      processItem(child, '', 0);
    });
    return result;
  };
  const buildOutlineTree = (items: Outline[]) => {
    const treeData = recursiveCataData(items);
    setCataData(treeData);
    return treeData;
  };
  const findNode = (id: string) => {
    const find = (nodes: Outline[]): any => {
      for (const node of nodes) {
        if (node.id === id) {
          return node;
        }
        if (node.children) {
          const result = find(node.children || []);
          if (result) {
            return result;
          }
        }
      }
      return null;
    };
    return find(chapters);
  };

  // Helper function to find the best node to select after deletion
  const findBestNodeAfterDeletion = (
    deletedOutline: Outline,
  ): Outline | null => {
    // If it's a chapter (depth 0), don't auto-select anything
    if ((deletedOutline.depth || 0) === 0) {
      return null;
    }

    // Find the parent node using parent_bid first
    let parent = findNode(deletedOutline.parent_bid || '');

    // If parent_bid is undefined or parent not found, search through all chapters to find the actual parent
    if (!parent) {
      for (const chapter of chapters) {
        const searchInNode = (node: Outline): Outline | null => {
          if (node.children) {
            for (const child of node.children) {
              if (child.id === deletedOutline.id) {
                return node; // Found the parent
              }
              const result = searchInNode(child);
              if (result) return result;
            }
          }
          return null;
        };
        const foundParent = searchInNode(chapter);
        if (foundParent) {
          parent = foundParent;
          break;
        }
      }
    }

    if (!parent?.children) {
      return null;
    }

    // Find the index of the deleted node in parent's children
    const deletedIndex = parent.children.findIndex(
      (child: any) => child.id === deletedOutline.id,
    );

    if (deletedIndex > 0) {
      // Select the previous sibling (the node above)
      return parent.children[deletedIndex - 1];
    } else if (deletedIndex === 0) {
      // If it's the first child, select the parent (chapter)
      return parent;
    }

    return null;
  };
  // Helper function to remove outline from tree structure
  const removeOutlineFromTree = (outline: Outline) => {
    if (outline.parent_bid) {
      const parent = findNode(outline.parent_bid || '');
      if (parent) {
        parent.children = parent.children?.filter(
          (child: any) => child.id !== outline.id,
        );
      }
    } else {
      const list = chapters.filter((child: any) => child.id !== outline.id);
      setChapters([...list]);
      return;
    }
    setChapters([...chapters]);
  };

  // Helper function to clean up catalog data
  const cleanupCatalogData = (outline: Outline) => {
    delete cataData[outline.id];
    setCataData({ ...cataData });
  };

  // Helper function to handle API deletion
  const deleteOutlineAPI = async (outline: Outline) => {
    if (outline.id === 'new_chapter') {
      return;
    }
    await api.deleteOutline({
      shifu_bid: currentShifu?.bid || '',
      outline_bid: outline.id,
    });
  };

  // Helper function to handle cursor positioning after deletion
  const handleCursorPositioning = async (nextNode: Outline | null) => {
    if (nextNode) {
      setCurrentNode(nextNode);
      if (nextNode.bid) {
        await loadMdflow(nextNode.bid, currentShifu?.bid || '');
      } else {
        setBlocks([]);
      }
    } else {
      setCurrentNode(null);
      setBlocks([]);
    }
    setFocusId('');
  };

  // Remove placeholder nodes locally without hitting APIs
  const removePlaceholderOutline = (outline: Outline) => {
    removeOutlineFromTree(outline);
    cleanupCatalogData(outline);
    setFocusId('');
  };

  const removeOutline = async (outline: Outline) => {
    setIsSaving(true);
    setError(null);

    const isCurrentNodeDeleted = currentNode?.id === outline.id;
    const nextNode = isCurrentNodeDeleted
      ? findBestNodeAfterDeletion(outline)
      : null;

    try {
      removeOutlineFromTree(outline);
      cleanupCatalogData(outline);
      await deleteOutlineAPI(outline);

      if (isCurrentNodeDeleted) {
        await handleCursorPositioning(nextNode);
      }

      setLastSaveTime(new Date());
    } catch (error) {
      console.error(error);
      setError('Failed to remove outline');
    } finally {
      setIsSaving(false);
    }
  };

  const remapOutlineTree = (items: any): Outline[] => {
    return items.map((item: any) => {
      return {
        id: item.bid,
        type: item.type,
        is_hidden: item.is_hidden,
        name: item.name,
        bid: item.bid,
        position: item.position,
        children: remapOutlineTree(item.children),
      };
    });
  };

  const loadMdflow = async (outlineId: string, shifuId: string) => {
    if (
      outlineId === '' ||
      outlineId === 'new_lesson' ||
      outlineId === 'new_chapter'
    ) {
      return;
    }
    setIsLoading(true);
    setError(null);
    const mdflow = await api.getMdflow({
      shifu_bid: shifuId,
      outline_bid: outlineId,
    });
    setMdflow(mdflow);
    setCurrentMdflow(mdflow);
    // if (mdflow) {
    await parseMdflow(mdflow, shifuId, outlineId);
    // } else {
    // setVariables([]);
    // setSystemVariables([]);
    // }
    setIsLoading(false);
  };

  const loadChapters = async (shifuId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const shifuInfo = await api.getShifuDetail({ shifu_bid: shifuId });
      setCurrentShifu(shifuInfo);
      const chaptersData = await api.getShifuOutlineTree({
        shifu_bid: shifuId,
      });
      const list = remapOutlineTree(chaptersData);
      if (list.length > 0) {
        // Find the first leaf node (lesson) to select by default
        let firstLesson: Outline | null = null;

        // Look for the first lesson node (depth > 0, typically chapter's child)
        for (const chapter of list) {
          if (chapter.children && chapter.children.length > 0) {
            firstLesson = chapter.children[0];
            break;
          }
        }

        if (firstLesson) {
          setCurrentNode({
            ...firstLesson,
            depth: 1,
          });
          await loadMdflow(firstLesson.bid, shifuId);
        }
      }
      setChapters(list);
      buildOutlineTree(list);
    } catch (error) {
      console.error(error);
      setError('Failed to load chapters');
    } finally {
      setIsLoading(false);
    }
  };

  const autoSaveBlocks = (
    payload?: SaveMdflowPayload,
  ): Promise<ApiResponse<SaveBlockListResult> | null> => {
    debouncedAutoSaveRef.current(payload);
    return Promise.resolve(null);
  };

  const flushAutoSaveBlocks = (payload?: SaveMdflowPayload) => {
    if (payload) {
      debouncedAutoSaveRef.current(payload);
    }
    debouncedAutoSaveRef.current.flush();
  };

  const cancelAutoSaveBlocks = () => {
    debouncedAutoSaveRef.current.cancel();
  };

  const createOutline = async (data: Outline) => {
    setIsSaving(true);
    setError(null);
    updateOutlineStatus(data.bid, 'saving');

    const parent = findNode(data.parent_bid || '');
    const index =
      parent?.children?.findIndex((child: Outline) => child.bid === data.bid) ||
      0;

    const isNew = data.bid === 'new_chapter' || data.bid === 'new_lesson';

    try {
      if (isNew) {
        const newUnit = await api.createOutline({
          parent_bid: data.parent_bid,
          index,
          name: data.name,
          description: data.name,
          type: LEARNING_PERMISSION.TRIAL,
          system_prompt: '',
          is_hidden: false,
          shifu_bid: currentShifu?.bid || '',
        });

        replaceOutline(data.bid, {
          id: newUnit.bid,
          bid: newUnit.bid,
          name: newUnit.name,
          position: '',
          children: [],
        });

        trackEvent('creator_outline_create', {
          shifu_bid: currentShifu?.bid || '',
          outline_bid: newUnit.bid,
          outline_name: newUnit.name,
          parent_bid: data.parent_bid || '',
        });
        setFocusId('');
        setLastSaveTime(new Date());
      } else {
        await api.modifyOutline({
          outline_bid: data.id,
          index: index,
          description: data.name,
          name: data.name,
          shifu_bid: currentShifu?.bid || '',
        });
        replaceOutline(data.id, {
          id: data.id,
          bid: data.bid,
          name: data.name,
          position: data.position,
        });
        setFocusId('');
        setLastSaveTime(new Date());
      }
    } catch (error) {
      console.error(error);
      setError(
        data.id === 'new_chapter'
          ? 'Failed to create unit'
          : 'Failed to modify unit',
      );
      updateOutlineStatus(data.id, data.id === 'new_chapter' ? 'new' : 'edit');
      setFocusId(data.id);
    } finally {
      setIsSaving(false);
      setIsLoading(false);
    }
  };

  const updateOutlineStatus = (
    id: string,
    status: 'new' | 'edit' | 'saving',
  ) => {
    setCataData({
      ...cataData,
      [id]: {
        ...cataData[id],
        status,
      },
    });
  };

  const updateOutline = async (id: string, value: Outline) => {
    setCataData({
      ...cataData,
      [id]: {
        ...cataData[id],
        ...value,
      },
    });
    setLastSaveTime(new Date());
  };

  const replaceOutline = async (id: string, outline: Outline) => {
    const node = findNode(id);
    node.id = outline.id;
    node.name = outline.name;
    node.position = outline.position;
    node.parent_bid = outline.parent_bid;
    node.bid = outline.bid;
    if (outline.children && outline.children.length > 0) {
      node.children = outline.children;
    }
    setChapters([...chapters]);
    delete cataData[id];
    setCataData({
      ...cataData,
      [outline.id]: {
        ...outline,
        status: 'edit',
      },
    });
  };

  const loadModels = async () => {
    const list = await api.getModelList({});
    setModels(list);
  };

  const reorderOutlineTree = async (outlines: ReorderOutlineItemDto[]) => {
    await api.reorderOutlineTree({
      shifu_bid: currentShifu?.bid || '',
      outlines,
    });
  };

  const parseMdflow = async (
    value: string,
    shifuId: string,
    outlineId: string,
  ) => {
    setIsLoading(true);
    try {
      const list = await api.getProfileItemDefinitions({
        parent_id: shifuId,
        type: 'all',
      });
      const sysVariables = list
        .filter(item => item.profile_scope === 'system')
        .map(item => ({
          name: item.profile_key,
          label: item.profile_remark,
        }));

      setSystemVariables(sysVariables);

      const customVariables = list
        .filter(item => item.profile_scope === 'user')
        .map(item => item.profile_key);

      setVariables(customVariables || []);
    } catch (error) {
      console.error(error);
      setSystemVariables([]);
      setVariables([]);
    } finally {
      setIsLoading(false);
    }
  };

  const previewParse = async (
    value: string,
    shifuId: string,
    outlineId: string,
  ): Promise<{
    variables: PreviewVariablesMap;
    blocksCount: number;
    systemVariableKeys: string[];
  }> => {
    try {
      const resolvedShifuId = shifuId || currentShifu?.bid || '';
      const resolvedOutlineId = outlineId || currentNode?.bid || '';
      const result = await api.parseMdflow({
        shifu_bid: resolvedShifuId,
        outline_bid: resolvedOutlineId,
        data: value,
      });
      const variableKeys = result?.variables || [];
      const systemVariableKeys =
        systemVariables?.map(variable => variable.name).filter(Boolean) || [];
      const storedVariables: StoredVariablesByScope =
        getStoredPreviewVariables(resolvedShifuId);
      const variablesMap = mapKeysToStoredVariables(
        variableKeys,
        storedVariables,
        systemVariableKeys,
      );
      savePreviewVariables(resolvedShifuId, variablesMap, systemVariableKeys);
      return {
        variables: variablesMap,
        blocksCount: result?.blocks_count ?? 0,
        systemVariableKeys,
      };
    } catch (error) {
      console.error(error);
      return { variables: {}, blocksCount: 0, systemVariableKeys: [] };
    }
  };

  const saveMdflow = async (payload?: SaveMdflowPayload) => {
    const shifu_bid = payload?.shifu_bid ?? currentShifu?.bid ?? '';
    const outline_bid = payload?.outline_bid ?? (currentNode?.bid || '');
    const data = payload?.data ?? currentMdflow.current;
    await api.saveMdflow({
      shifu_bid,
      outline_bid,
      data,
    });
    setLastSaveTime(new Date());
  };

  const setCurrentMdflow = (value: string) => {
    currentMdflow.current = value;
    setMdflow(value || '');
  };

  const removePlaceholderLessons = (nodes: Outline[] = []): Outline[] => {
    return nodes
      .filter(node => node.id !== 'new_lesson')
      .map(node => ({
        ...node,
        children: removePlaceholderLessons(node.children || []),
      }));
  };

  const findNodeInList = (nodes: Outline[], id: string): Outline | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNodeInList(node.children || [], id);
      if (found) return found;
    }
    return null;
  };

  const insertPlaceholderChapter = () => {
    if (chapters.some(ch => ch.id === 'new_chapter')) return;

    const placeholder: Outline = {
      id: 'new_chapter',
      bid: 'new_chapter',
      name: '',
      parent_bid: '',
      children: [],
      depth: 0,
      position: '',
      type: LEARNING_PERMISSION.TRIAL,
      is_hidden: false,
    };

    setChapters([...chapters, placeholder]);

    setCataData({
      ...cataData,
      ['new_chapter']: {
        ...placeholder,
        parentId: '',
        status: 'new',
      },
    });

    setFocusId('new_chapter');
  };

  const insertPlaceholderLesson = (parent: Outline) => {
    if (!parent) return;

    let addedPlaceholder: Outline | null = null;
    let placeholderParentId: string | null = null;

    setChapters(prev => {
      const cleaned = removePlaceholderLessons(prev);
      const parentNode = findNodeInList(cleaned, parent.id);
      if (!parentNode) {
        return cleaned;
      }

      if (parentNode.children?.some(ch => ch.id === 'new_lesson')) {
        return cleaned;
      }

      const placeholder: Outline = {
        id: 'new_lesson',
        bid: 'new_lesson',
        name: '',
        parent_bid: parentNode.id,
        children: [],
        depth: (parentNode.depth || parent.depth || 0) + 1,
        position: '',
        type: LEARNING_PERMISSION.TRIAL,
        is_hidden: false,
      };

      parentNode.children = [...(parentNode.children || []), placeholder];
      addedPlaceholder = placeholder;
      placeholderParentId = parentNode.id;
      return cleaned;
    });

    // prevent duplicate placeholder lesson
    setCataData(prev => {
      const next = { ...prev };
      delete next['new_lesson'];
      if (addedPlaceholder && placeholderParentId) {
        next['new_lesson'] = {
          ...addedPlaceholder,
          parentId: placeholderParentId,
          status: 'new',
        };
      }
      return next;
    });

    if (addedPlaceholder) {
      setFocusId('new_lesson');
    }
  };

  const value: ShifuContextType = {
    currentShifu,
    chapters,
    isLoading,
    isSaving,
    error,
    lastSaveTime,
    focusId,
    focusValue,
    cataData,
    blocks,
    currentNode,
    models,
    mdflow,
    variables,
    systemVariables,
    actions: {
      setFocusId,
      setChapters,
      loadShifu,
      loadChapters,
      setFocusValue,
      updateOutline,
      removeOutline,
      replaceOutline,
      createOutline,
      setBlocks,
      autoSaveBlocks,
      setCurrentNode,
      loadModels,
      reorderOutlineTree,
      loadMdflow,
      saveMdflow,
      parseMdflow,
      previewParse,
      setCurrentMdflow,
      flushAutoSaveBlocks,
      cancelAutoSaveBlocks,
      insertPlaceholderChapter,
      insertPlaceholderLesson,
      removePlaceholderOutline,
    },
  };

  return (
    <ShifuContext.Provider value={value}>{children}</ShifuContext.Provider>
  );
};

export const useShifu = (): ShifuContextType => {
  const context = useContext(ShifuContext);
  if (context === undefined) {
    throw new Error('useShifu must be used within a ShifuProvider');
  }
  return context;
};
