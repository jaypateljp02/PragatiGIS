import DocumentUpload from '../DocumentUpload';

export default function DocumentUploadExample() {
  return (
    <DocumentUpload 
      onFilesUploaded={(files) => console.log('Files uploaded:', files)}
      maxFiles={10}
      acceptedTypes={['.pdf', '.jpg', '.jpeg', '.png', '.tiff']}
    />
  );
}