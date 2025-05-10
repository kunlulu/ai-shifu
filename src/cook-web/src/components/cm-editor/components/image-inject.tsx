/** inject image to mc-editor */
import React, { useState } from 'react'
import { ImageUploader } from '@/components/file-uploader'
import { Button } from '@/components/ui/button'

type ImageInjectProps = {
  value?: string
  onSelect: (url: string) => void
}

const ImageInject: React.FC<ImageInjectProps> = ({ value, onSelect }) => {
  const [imageUrl, setImageUrl] = useState<string>(value || '')
  const handleSelect = () => {
    onSelect(imageUrl)
  }
  return (
    <div>
      <ImageUploader value={imageUrl} onChange={url => setImageUrl(url)} />
      <div className='flex py-4 justify-end'>
        <Button className='h-8' onClick={handleSelect} disabled={!imageUrl}>
          使用图片
        </Button>
      </div>
    </div>
  )
}

export default ImageInject
