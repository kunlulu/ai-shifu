'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { autocompletion } from '@codemirror/autocomplete'
import { EditorView } from '@codemirror/view'
import CustomDialog from './components/custom-dialog'
import EditorContext from './editor-context'
import type { Profile } from '@/components/profiles/type'
import ImageInject from './components/image-inject'
import VideoInject from './components/video-inject'
import ProfileInject from './components/profile-inject'
import { SelectedOption, IEditorContext } from './type'
import { useTranslation } from 'react-i18next'

import './index.css'

import {
  profilePlaceholders,
  imgPlaceholders,
  videoPlaceholders,
  createSlashCommands
} from './util'

type EditorProps = {
  content?: string
  isEdit?: boolean
  profiles?: string[]
  onChange?: (value: string, isEdit: boolean) => void
}

const Editor: React.FC<EditorProps> = ({
  content = '',
  isEdit,
  profiles = [],
  onChange
}) => {
  const { t } = useTranslation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedOption, setSelectedOption] = useState<SelectedOption>(
    SelectedOption.Empty
  )
  const [profileList, setProfileList] = useState<string[]>(profiles)
  const [currentSelectContent, setCurrentSelectContent] = useState<string>()
  const editorViewRef = useRef<EditorView | null>(null)

  const editorContextValue: IEditorContext = {
    selectedOption: SelectedOption.Empty,
    setSelectedOption,
    dialogOpen,
    setDialogOpen,
    profileList,
    setProfileList
  }

  const onSelectedOption = useCallback((selectedOption: SelectedOption) => {
    setDialogOpen(true)
    setSelectedOption(selectedOption)
  }, [])

  const insertTextAsTag = useCallback(
    (text: string) => {
      if (!editorViewRef.current) return

      const { state, dispatch } = editorViewRef.current
      const from = state.selection.main.from

      dispatch({
        changes: { from, insert: text },
        selection: { anchor: from + text.length }
      })
    },
    [editorViewRef]
  )

  const handleSelectProfile = useCallback(
    (profile: Profile) => {
      const textToInsert = `{${profile.profile_key}}`
      insertTextAsTag(textToInsert)
      setDialogOpen(false)
    },
    [insertTextAsTag, selectedOption]
  )

  const handleSelectResource = useCallback(
    (resourceUrl: string) => {
      const textToInsert = ` ${resourceUrl}`
      insertTextAsTag(textToInsert)
      setDialogOpen(false)
    },
    [insertTextAsTag, selectedOption]
  )

  const slashCommandsExtension = useCallback(() => {
    return autocompletion({
      override: [createSlashCommands(onSelectedOption)]
    })
  }, [onSelectedOption])

  const handleEditorUpdate = useCallback((view: EditorView) => {
    editorViewRef.current = view
  }, [])

  const handleTagClick = useCallback(
    (event: any) => {
      const { type, content } = event.detail
      setCurrentSelectContent(content)
      setSelectedOption(type)
      setDialogOpen(true)
    },
    [setSelectedOption, setDialogOpen]
  )

  useEffect(() => {
    window.addEventListener('globalTagClick', handleTagClick)

    return () => {
      window.removeEventListener('globalTagClick', handleTagClick)
    }
  }, [handleTagClick])

  return (
    <>
      <EditorContext.Provider value={editorContextValue}>
        {isEdit ? (
          <>
            <CodeMirror
              extensions={[
                EditorView.lineWrapping,
                slashCommandsExtension(),
                profilePlaceholders,
                imgPlaceholders,
                videoPlaceholders,
                EditorView.updateListener.of(update => {
                  handleEditorUpdate(update.view)
                })
              ]}
              basicSetup={{
                lineNumbers: false,
                syntaxHighlighting: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
                foldGutter: false
              }}
              className='border rounded-md'
              placeholder={t('cm-editor.input-slash-to-insert-content')}
              value={content}
              theme='light'
              height='10em'
              onChange={(value: string) => {
                onChange?.(value, isEdit || false)
              }}
            />
            <CustomDialog>
              {selectedOption === SelectedOption.Profile && (
                <ProfileInject onSelect={handleSelectProfile} />
              )}
              {selectedOption === SelectedOption.Image && (
                <ImageInject value={currentSelectContent} onSelect={handleSelectResource} />
              )}
              {selectedOption === SelectedOption.Video && (
                <VideoInject value={currentSelectContent} onSelect={handleSelectResource} />
              )}
            </CustomDialog>
          </>
        ) : (
          <div className='w-full p-2 rounded cursor-pointer font-mono'>
            {content}
          </div>
        )}
      </EditorContext.Provider>
    </>
  )
}
export default Editor
