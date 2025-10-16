'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import type { DropTargetMonitor } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from '@/components/ui/Button';
import {
  Plus,
  GripVertical,
  Trash2,
  SquarePen,
  BugPlay,
  Settings2,
  ListCollapse,
} from 'lucide-react';
import { useShifu } from '@/store';
import { useUserStore } from '@/store';
import OutlineTree from '@/components/outline-tree';
import '@mdxeditor/editor/style.css';
import Header from '../header';
import { BlockDTO, BlockType, ContentDTO } from '@/types/shifu';
import RenderBlockUI from '../render-ui';
import { MarkdownFlowEditor, EditMode, UploadProps} from 'markdown-flow-ui'
// import MarkdownFlowEditor, { EditMode } from '../../../../../../markdown-flow-ui/src/components/MarkdownFlowEditor/MarkdownFlowEditor';
// import type { UploadProps } from 'markdown-flow-ui/src/components/MarkdownFlowEditor/uploadTypes';
import AIDebugDialog from '@/components/ai-debug';
import 'markdown-flow-ui/dist/markdown-flow-ui.css';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import './shifuEdit.scss';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/AlertDialog';
import AddBlock from '@/components/add-block';
import Loading from '../loading';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { getStringEnv } from '@/c-utils/envUtils';


const ScriptEditor = ({ id }: { id: string }) => {
  const { t } = useTranslation();
  const profile = useUserStore(state => state.userInfo);
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>(
    {},
  );
  const [foldOutlineTree, setFoldOutlineTree] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>('quickEdit' as EditMode);
  const editModeOptions = useMemo(
    () => [
      {
        label: t('shifu.creationArea.modeText'),
        value: 'quickEdit' as EditMode,
      },
      {
        label: t('shifu.creationArea.modeCode'),
        value: 'codeEdit' as EditMode,
      },
    ],
    [t],
  );

  useEffect(() => {
    if (profile) {
      i18n.changeLanguage(profile.language);
    }
  }, [profile]);
  const {
    blocks,
    mdflow,
    chapters,
    actions,
    blockContentTypes,
    blockProperties,
    // blockUIProperties,
    // blockUITypes,
    currentNode,
    isLoading,
    currentShifu,
    variables,
    systemVariables,
    blockErrors,
  } = useShifu();

  const [debugBlockInfo, setDebugBlockInfo] = useState({
    blockId: '',
    visible: false,
  });

  const [removeBlockInfo, setRemoveBlockInfo] = useState({
    blockId: '',
    visible: false,
  });

  const [newBlockId, setNewBlockId] = useState('');

  const token = useUserStore(state => state.getToken());

  const onAddChapter = () => {
    actions.addChapter({
      parent_bid: '',
      bid: 'new_chapter',
      id: 'new_chapter',
      name: ``,
      children: [],
      position: '',
      depth: 0,
    });
    setTimeout(() => {
      document.getElementById('new_chapter')?.scrollIntoView({
        behavior: 'smooth',
      });
    }, 800);
  };

  const onDebugBlock = (id: string) => {
    setDebugBlockInfo({ blockId: id, visible: true });
  };

  const onDebugBlockClose = () => {
    setDebugBlockInfo({ blockId: '', visible: false });
  };

  const onRemove = async (id: string) => {
    setRemoveBlockInfo({ blockId: id, visible: true });
  };

  const handleConfirmDelete = async (id: string | undefined) => {
    if (!id) return;
    try {
      await actions.removeBlock(id, currentShifu?.bid || '');
      setRemoveBlockInfo({ blockId: '', visible: false });
    } catch (error) {
      console.error(error);
    }
  };

  const onAddBlock = async (index: number, type: BlockType, bid: string) => {
    const blockId = await actions.addBlock(index, type, bid);
    if (blockId && ['content', 'input', 'goto', 'options'].includes(type)) {
      setNewBlockId(blockId);
      setExpandedBlocks(prev => ({
        ...prev,
        [blockId]: true,
      }));
    }
  };

  useEffect(() => {
    console.log('newBlockId', newBlockId);
    if (newBlockId && expandedBlocks[newBlockId] === false) {
      console.log('setExpandedBlocks', newBlockId);
      setExpandedBlocks(prev => ({
        ...prev,
        [newBlockId]: true,
      }));
      setNewBlockId('');
    }
  }, [newBlockId, expandedBlocks]);

  useEffect(() => {
    console.log('expandedBlocks', expandedBlocks);
  }, [expandedBlocks]);

  const onChangeBlockType = async (id: string, llm_enabled: boolean) => {
    const p = blockProperties[id].properties as ContentDTO;
    await actions.updateBlockProperties(id, {
      ...blockProperties[id],
      properties: {
        ...p,
        llm_enabled: llm_enabled,
      },
    });

    actions.saveBlocks(currentShifu?.bid || '');
  };

  useEffect(() => {
    actions.loadModels();
    if (id) {
      console.log('loadChapters', id);
      actions.loadChapters(id);
    }
  }, [id]);

  const variablesList = useMemo(() => {
    return variables.map((variable: string) => ({
      name: variable,
    }));
  }, [variables]);

  const systemVariablesList = useMemo(() => {
    return systemVariables.map((variable: Record<string, string>) => ({
      name: variable.name,
      label: variable.label,
    }));
  }, [systemVariables]);
  
  const onChangeMdflow = (value: string) => {
    actions.setCurrentMdflow(value);
    actions.autoSaveBlocks();
  };

  const uploadProps: UploadProps = useMemo(() => ({
    action: `${getStringEnv('baseURL')}/api/shifu/upfile`,
    headers: {
      Authorization: `Bearer ${token}`,
      Token: token,
    },
  }), [token]);

  return (
    <div className='flex flex-col h-screen bg-gray-50'>
      <Header />
      <div className='flex-1 flex overflow-hidden scroll-y'>
        <div className='p-4 bg-white'>
          <div className='flex items-center justify-between gap-3'>
            <div
              onClick={() => setFoldOutlineTree(!foldOutlineTree)}
              className='rounded border bg-white p-1 cursor-pointer text-sm hover:bg-gray-200'
            >
              <ListCollapse className='h-5 w-5' />
            </div>
            {!foldOutlineTree && (
              <Button
                variant='outline'
                className='h-8 bottom-0 left-4 flex-1'
                size='sm'
                onClick={onAddChapter}
              >
                <Plus />
                {t('shifu.newChapter')}
              </Button>
            )}
          </div>

          {!foldOutlineTree && (
            <div className='flex-1 h-full overflow-y-auto overflow-x-hidden w-[256px]'>
              <ol className=' text-sm'>
                <OutlineTree
                  items={chapters}
                  onChange={newChapters => {
                    actions.setChapters([...newChapters]);
                  }}
                />
              </ol>
            </div>
          )}
        </div>
        <div className='flex-1 overflow-auto relative text-sm'>
          <div className='p-8 gap-4 flex flex-col max-w-[900px] mx-auto h-full w-full'>
            {isLoading ? (
              <div className='h-40 flex items-center justify-center'>
                <Loading />
              </div>
            ) : (
              <>
                <div className='flex items-center justify-between gap-4'>
                  <div className='flex items-center'>
                    <h2 className='text-base font-semibold text-foreground'>
                      {t('shifu.creationArea.title')}
                    </h2>
                    <p className='px-2 text-xs leading-3 text-[rgba(0,0,0,0.45)]'>
                      {t('shifu.creationArea.description')}
                    </p>
                  </div>
                  <Tabs
                    value={editMode}
                    onValueChange={value => setEditMode(value as EditMode)}
                    className='ml-auto'
                  >
                    <TabsList className='h-8 rounded-full bg-muted/60 p-0 text-xs'>
                      {editModeOptions.map(option => (
                        <TabsTrigger
                          key={option.value}
                          value={option.value}
                          className={cn(
                            'mode-btn rounded-full px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground',
                          )}
                        >
                          {option.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
                <MarkdownFlowEditor 
                  locale={profile?.language as "en-US" | "zh-CN"} 
                  content={mdflow} 
                  variables={variablesList}
                  systemVariables={systemVariablesList as any[]}
                  onChange={onChangeMdflow}
                  editMode={editMode}
                  uploadProps={uploadProps}
                />
              </>
              // <>
              //   <DndProvider backend={HTML5Backend}>
              //     {blocks.map((block, index) => (
              //       <DraggableBlock
              //         key={block.bid}
              //         id={block.bid}
              //         block={block}
              //         type={block.type as BlockType}
              //         index={index}
              //         moveBlock={(dragIndex: number, hoverIndex: number) => {
              //           const dragBlock = blocks[dragIndex];
              //           const newBlocks = [...blocks];
              //           newBlocks.splice(dragIndex, 1);
              //           newBlocks.splice(hoverIndex, 0, dragBlock);
              //           actions.setBlocks(newBlocks);
              //           actions.autoSaveBlocks(
              //             currentNode!.bid,
              //             newBlocks,
              //             blockContentTypes,
              //             blockProperties,
              //             currentShifu?.bid || '',
              //           );
              //         }}
              //         onClickChangeType={onChangeBlockType}
              //         onClickDebug={onDebugBlock}
              //         onClickRemove={onRemove}
              //         disabled={expandedBlocks[block.bid]}
              //         error={blockErrors[block.bid]}
              //       >
              //         <div
              //           id={block.bid}
              //           className='relative flex flex-col gap-2 '
              //         >
              //           <RenderBlockUI
              //             block={block}
              //             onExpandChange={expanded => {
              //               setExpandedBlocks(prev => ({
              //                 ...prev,
              //                 [block.bid]: expanded,
              //               }));
              //             }}
              //             expanded={expandedBlocks[block.bid]}
              //           />
              //           <div>
              //             <AddBlock
              //               onAdd={(type: BlockType) => {
              //                 onAddBlock(index + 1, type, id);
              //               }}
              //             />
              //           </div>
              //         </div>
              //       </DraggableBlock>
              //     ))}
              //   </DndProvider>
              //   {(currentNode?.depth || 0) > 0 && blocks.length === 0 && (
              //     <div className='flex flex-row items-center justify-start h-6'>
              //       <AddBlock
              //         onAdd={(type: BlockType) => {
              //           onAddBlock(1, type, id);
              //         }}
              //       />
              //     </div>
              //   )}
              // </>
            )}
          </div>
        </div>
      </div>
      {debugBlockInfo.visible && (
        <AIDebugDialog
          blockId={debugBlockInfo.blockId}
          open={true}
          onOpenChange={onDebugBlockClose}
        />
      )}

      <AlertDialog
        open={removeBlockInfo.visible}
        onOpenChange={(visible: boolean) => {
          setRemoveBlockInfo({
            ...removeBlockInfo,
            visible,
          });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('renderBlock.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('renderBlock.confirmDeleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('renderBlock.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleConfirmDelete(removeBlockInfo.blockId)}
            >
              {t('renderBlock.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ScriptEditor;
