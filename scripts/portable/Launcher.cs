using System;
using System.IO;
using System.IO.Compression;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;

class Launcher {
    static string LongPath(string path) {
        path=Path.GetFullPath(path);
        return path.StartsWith(@"\\") ? @"\\?\UNC\"+path.Substring(2) : @"\\?\"+path;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int type, IntPtr info, uint length);
    [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits { public long Time1, Time2; public uint Flags; public UIntPtr Min, Max; public uint Active; public UIntPtr Affinity; public uint Priority, Scheduling; }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong A, B, C, D, E, F; }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits { public BasicLimits Basic; public IoCounters Io; public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
    static int Main() {
        IntPtr job=IntPtr.Zero;
        try {
            AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling",false);
            AppContext.SetSwitch("Switch.System.IO.BlockLongPaths",false);
            Console.Title="Aviation Insight - Portable";
            string home=Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string data=Path.Combine(home,"AviationInsight-data");
            string version="__BUILD_ID__";
            string runtime=Path.Combine(data,"runtime",version);
            Directory.CreateDirectory(data);
            using(var guard=new FileStream(Path.Combine(data,"running.lock"),FileMode.OpenOrCreate,FileAccess.ReadWrite,FileShare.None)) {
                if(!File.Exists(Path.Combine(runtime,".ready"))) {
                    Console.WriteLine("Preparing the portable app. This can take a minute on first run...");
                    string temp=runtime+"-"+Guid.NewGuid().ToString("N");
                    Directory.CreateDirectory(temp);
                    using(var payload=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
                    using(var zip=new ZipArchive(payload,ZipArchiveMode.Read)) {
                        string root=Path.GetFullPath(temp)+Path.DirectorySeparatorChar;
                        foreach(var entry in zip.Entries) {
                            string target=Path.GetFullPath(Path.Combine(temp,entry.FullName));
                            if(!target.StartsWith(root,StringComparison.OrdinalIgnoreCase))throw new IOException("Invalid package entry");
                            if(entry.Name.Length==0){Directory.CreateDirectory(LongPath(target));continue;}
                            Directory.CreateDirectory(LongPath(Path.GetDirectoryName(target)));
                            entry.ExtractToFile(LongPath(target));
                        }
                    }
                    File.WriteAllText(Path.Combine(temp,".ready"),version);
                    Directory.CreateDirectory(Path.GetDirectoryName(runtime));
                    if(Directory.Exists(runtime))throw new IOException("Incomplete runtime exists. Remove only this runtime folder and retry: "+runtime);
                    Directory.Move(temp,runtime);
                }
                job=CreateJobObject(IntPtr.Zero,null);
                var limits=new ExtendedLimits();limits.Basic.Flags=0x2000; // Kill the server/browser children when launcher closes.
                int size=Marshal.SizeOf(limits);IntPtr buffer=Marshal.AllocHGlobal(size);
                try{Marshal.StructureToPtr(limits,buffer,false);if(job==IntPtr.Zero||!SetInformationJobObject(job,9,buffer,(uint)size))throw new IOException("Cannot initialize app process group");}finally{Marshal.FreeHGlobal(buffer);}
                var start=new ProcessStartInfo(Path.Combine(runtime,"node.exe"),"\""+Path.Combine(runtime,"bootstrap.mjs")+"\"");
                start.WorkingDirectory=runtime;start.UseShellExecute=false;
                start.EnvironmentVariables["AVIATION_DATA_DIR"]=data;
                using(var child=Process.Start(start)) {
                    if(!AssignProcessToJobObject(job,child.Handle)){child.Kill();throw new IOException("Cannot manage local server process");}
                    child.WaitForExit();if(child.ExitCode!=0)throw new Exception("Local server exited with code "+child.ExitCode);
                }
            }
            return 0;
        } catch(Exception error) {
            Console.Error.WriteLine("Cannot start Aviation Insight: "+error.Message);
            Console.Error.WriteLine("Use a writable folder. If it is already running, close the other app window.");
            if(Environment.GetEnvironmentVariable("AVIATION_NO_PAUSE")!="1"){Console.WriteLine("Press Enter to close.");Console.ReadLine();}
            return 1;
        } finally {if(job!=IntPtr.Zero)CloseHandle(job);}
    }
}
