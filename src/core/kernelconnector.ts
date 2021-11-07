// SOURCE: https://github.com/lckr/jupyterlab-variableInspector


import {
    ISessionContext
} from "@jupyterlab/apputils";

import {
    Kernel,
    KernelMessage
} from "@jupyterlab/services";

import {
    ISignal, Signal
} from "@lumino/signaling";



/**
 * Connector class that handles execute request to a kernel
 */
export
    class KernelConnector {

    private _session: ISessionContext;
    private _kernelRestarted = new Signal<this, Promise<void>>(this); 
    private _kernelShutDown = new Signal<this, Promise<void>>(this); 

    constructor( options: KernelConnector.IOptions ) {
        this._session = options.session;
        this._session.statusChanged.connect( (sender: ISessionContext, new_status: KernelMessage.Status)=>{
            switch (new_status) {
            	case "restarting":
                case "autorestarting":
            	    this._kernelRestarted.emit(this._session.ready);
            	default:
            		break;
            }
        });

        
        // This is useful if we want to support manually shutind down and restarting Kernels, which we won't support for the moment for simplif
        this._session.connectionStatusChanged.connect((sender: ISessionContext, connectionStatus: Kernel.ConnectionStatus)=>{
            //console.log('Debug: Connection status ->', connectionStatus);
            switch (connectionStatus) {
                case "connected":
                case "disconnected":
                    this._kernelShutDown.emit(this._session.ready);
                default:
                    break;
            }
        });
        
    }

    get kernelRestarted(): ISignal<KernelConnector, Promise<void>>{
        return this._kernelRestarted;
    }

    get kernelShutDown(): ISignal<KernelConnector, Promise<void>>{
        return this._kernelShutDown;
    }


    get kernelLanguage(): Promise<string> {

        return this._session.session.kernel.info.then(infoReply => {
            return infoReply.language_info.name;
        })
    }
 
    get kernelName(): string {
        return this._session.kernelDisplayName;
    }


    /**
     *  A Promise that is fulfilled when the session associated w/ the connector is ready.
     */
    get ready(): Promise<void> {
        return this._session.ready;
    }

    /**
     *  A signal emitted for iopub messages of the kernel associated with the kernel.
     */
    get iopubMessage(): ISignal<ISessionContext, KernelMessage.IMessage> {
        return this._session.iopubMessage;
    }



    /**
     * Executes the given request on the kernel associated with the connector.
     * @param content: IExecuteRequestMsg to forward to the kernel.
     * @param ioCallback: Callable to forward IOPub messages of the kernel to.
     * @returns Promise<KernelMessage.IExecuteReplyMsg>
     */
     fetch( content: KernelMessage.IExecuteRequestMsg['content'], ioCallback: ( msg: KernelMessage.IIOPubMessage ) => any ): Promise<KernelMessage.IExecuteReplyMsg> {
        const kernel = this._session.session.kernel;
        if ( !kernel ) {
            return Promise.reject( new Error( "Require kernel to perform variable inspection!" ) );
        }

        let future = kernel.requestExecute( content );

        future.onIOPub = ( ( msg: KernelMessage.IIOPubMessage ) => {
            ioCallback( msg );
        } );
        return future.done as Promise<KernelMessage.IExecuteReplyMsg>;
    }

    // Fetch function that leverages just a code string instead of a content message
    fetchCode(code: string,  ioCallback: ( msg: KernelMessage.IIOPubMessage ) => any): Promise<KernelMessage.IExecuteReplyMsg> {
      const content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: code,
        stop_on_error: false,
        store_history: false
      };

      return this.fetch(content, ioCallback)
    }

    execute( content: KernelMessage.IExecuteRequestMsg['content']) {
        return this._session.session.kernel.requestExecute(content);
    }

    // Fetch function that leverages just a code string instead of a content message
    executeCode( code: string) {
        const content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: code,
            stop_on_error: false,
            store_history: false
          };

        return this._session.session.kernel.requestExecute(content);
    }

    /*----------------------------------------------------------------------------------------------------
    [FUNCTION] Sends request to Kernel
    -> Returns: User expressions
    -----------------------------------------------------------------------------------------------------*/
    async executeCodeAndGetResult(
        runCode: string,
        userExpressions: any,
        runSilent = false,
        storeHistory = false,
        allowStdIn = false,
        stopOnError = false
    ): Promise<any> {
    // Wait for kernel to be ready before sending request
    // Kernel.ready is deprecated from 2.0: https://jupyterlab.readthedocs.io/en/stable/developer/extension_migration.html

    const message: KernelMessage.IShellMessage = await this._session.session.kernel.requestExecute({
        allow_stdin: allowStdIn,
        code: runCode,
        silent: runSilent,
        stop_on_error: stopOnError,
        store_history: storeHistory,
        user_expressions: userExpressions,
    }).done;

    const content: any = message.content;

    if (content.status !== 'ok') {
    // If response is not 'ok', throw contents as error, log code
    const msg = `Code caused an error:\n${runCode}`;
        console.error(msg);
        if (content.traceback) {
        content.traceback.forEach((line: string) =>
          console.log(
            line.replace(
              /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
              ''
            )
          )
        );
        }
        throw content;
    }
    // Return user_expressions of the content
    return content.user_expressions;
    
    }

}

export
namespace KernelConnector {
    export
        interface IOptions {
        session: ISessionContext;

    }
}