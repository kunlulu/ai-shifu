import {
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  MatchDecorator,
  WidgetType
} from '@codemirror/view'
import { SelectedOption } from './type'
// import { useTranslation } from 'react-i18next'

import './index.css'

class PlaceholderWidget extends WidgetType {
  constructor (
    private name: string,
    private styleClass: string,
    private type: SelectedOption,
    private view: EditorView
  ) {
    super()
  }

  toDOM () {
    const container = document.createElement('span')
    const span = document.createElement('span')
    span.className = this.styleClass
    span.textContent = `${this.name}`
    const icon = document.createElement('span')
    icon.className = 'tag-icon'
    icon.innerHTML = '✕'
    icon.addEventListener('click', e => {
      e.stopPropagation()
      let from = -1
      let to = -1
      const decorations = this.view.state.facet(EditorView.decorations)
      for (const deco of decorations) {
        const decoSet = typeof deco === 'function' ? deco(this.view) : deco
        decoSet.between(
          0,
          this.view.state.doc.length,
          (start: number, end: number, decoration: Decoration) => {
            if (decoration.spec.widget === this) {
              from = start
              to = end
              return false
            }
          }
        )
        if (from !== -1) break
      }
      if (from !== -1 && to !== -1) {
        this.view.dispatch({
          changes: { from, to, insert: '' }
        })
      }
    })
    container.appendChild(span).appendChild(icon)
    span.addEventListener('click', () => {
      const event = new CustomEvent('globalTagClick', {
        detail: { type: this.type, content: span.textContent }
      })
      window.dispatchEvent(event)
    })
    return container
  }

  ignoreEvent () {
    return false
  }
}

const profileMatcher = new MatchDecorator({
  regexp: /(\{\w+\})/g,
  decoration: (match, view) =>
    Decoration.replace({
      widget: new PlaceholderWidget(
        match[1],
        'tag-profile',
        SelectedOption.Profile,
        view
      )
    })
})

const imageUrlMatcher = new MatchDecorator({
  regexp:
    /(https?:\/\/(?:avtar\.agiclass\.cn)\S+(?:\.(?:png|jpg|jpeg|gif|bmp))?)/g,
  decoration: (match, view) =>
    Decoration.replace({
      widget: new PlaceholderWidget(
        match[1],
        'tag-image',
        SelectedOption.Image,
        view
      )
    })
})

const bilibiliUrlMatcher = new MatchDecorator({
  regexp: /(https?:\/\/(?:www\.|m\.)?bilibili\.com\/video\/\S+)/g,
  decoration: (match, view) =>
    Decoration.replace({
      widget: new PlaceholderWidget(
        match[1],
        'tag-video',
        SelectedOption.Video,
        view
      )
    })
})

const profilePlaceholders = ViewPlugin.fromClass(
  class {
    placeholders: DecorationSet
    constructor (view: EditorView) {
      this.placeholders = profileMatcher.createDeco(view)
    }
    update (update: ViewUpdate) {
      this.placeholders = profileMatcher.updateDeco(update, this.placeholders)
    }
  },
  {
    decorations: instance => instance.placeholders,
    provide: plugin =>
      EditorView.atomicRanges.of(view => {
        return view.plugin(plugin)?.placeholders || Decoration.none
      })
  }
)

const imgPlaceholders = ViewPlugin.fromClass(
  class {
    placeholders: DecorationSet
    constructor (view: EditorView) {
      this.placeholders = imageUrlMatcher.createDeco(view)
    }
    update (update: ViewUpdate) {
      this.placeholders = imageUrlMatcher.updateDeco(update, this.placeholders)
    }
  },
  {
    decorations: instance => instance.placeholders,
    provide: plugin =>
      EditorView.atomicRanges.of(view => {
        return view.plugin(plugin)?.placeholders || Decoration.none
      })
  }
)

const videoPlaceholders = ViewPlugin.fromClass(
  class {
    placeholders: DecorationSet
    constructor (view: EditorView) {
      this.placeholders = bilibiliUrlMatcher.createDeco(view)
    }
    update (update: ViewUpdate) {
      this.placeholders = bilibiliUrlMatcher.updateDeco(
        update,
        this.placeholders
      )
    }
  },
  {
    decorations: instance => instance.placeholders,
    provide: plugin =>
      EditorView.atomicRanges.of(view => {
        return view.plugin(plugin)?.placeholders || Decoration.none
      })
  }
)

function createSlashCommands (
  onSelectOption: (selectedOption: SelectedOption) => void
) {
  return (context: CompletionContext): CompletionResult | null => {
    // const { t } = useTranslation();
    const word = context.matchBefore(/\/(\w*)$/)
    if (!word) return null

    const handleSelect = (
      view: EditorView,
      _: any,
      from: number,
      to: number,
      selectedOption: SelectedOption
    ) => {
      view.dispatch({
        changes: { from, to, insert: '' }
      })
      onSelectOption(selectedOption)
    }

    return {
      from: word.from,
      to: word.to,
      options: [
        {
          // label: t('cm-editor.variable'),
          label: '变量',
          apply: (view, _, from, to) => {
            handleSelect(view, _, from, to, SelectedOption.Profile)
          }
        },
        {
          // label: t('cm-editor.image'),
          label: '图片',
          apply: (view, _, from, to) => {
            handleSelect(view, _, from, to, SelectedOption.Image)
          }
        },
        {
          // label: t('cm-editor.video'),
          label: '视频',
          apply: (view, _, from, to) => {
            handleSelect(view, _, from, to, SelectedOption.Video)
          }
        }
      ],
      filter: false
    }
  }
}

export {
  profilePlaceholders,
  imgPlaceholders,
  videoPlaceholders,
  createSlashCommands
}
