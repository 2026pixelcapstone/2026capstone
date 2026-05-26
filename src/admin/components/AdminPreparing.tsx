interface AdminPreparingProps {
  title: string;
}

const AdminPreparing = ({ title }: AdminPreparingProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-[500px] text-center">
      <div className="text-6xl mb-6">🚧</div>
      <h2 className="text-3xl font-bold text-gray-800 mb-4">{title}</h2>
      <p className="text-xl text-gray-500">
        현재 기능 개발 및 서비스 준비 중입니다. <br />
        조금만 기다려 주세요!
      </p>
      <div className="mt-8 w-16 h-1 bg-blue-500 rounded-full animate-pulse"></div>
    </div>
  );
};

export default AdminPreparing;